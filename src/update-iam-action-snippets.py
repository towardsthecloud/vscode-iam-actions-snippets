"""Build a validated IAM catalog from AWS's JSON inventory and reference tables."""

import argparse
import json
import os
import re
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

BASE_URL = "https://docs.aws.amazon.com/service-authorization/latest/reference/"
SERVICES_PAGE = "reference_policies_actions-resources-contextkeys.html"
SERVICE_LIST_URL = (
    "https://servicereference.us-east-1.amazonaws.com/v1/service-list.json"
)
ACCESS_LEVELS = {"List", "Read", "Write", "Permissions management", "Tagging"}
HTTP_STATE = threading.local()


def get_response(url):
    if not hasattr(HTTP_STATE, "session"):
        session = requests.Session()
        retry = Retry(
            total=3, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504]
        )
        session.mount("https://", HTTPAdapter(max_retries=retry))
        HTTP_STATE.session = session
    response = HTTP_STATE.session.get(url, timeout=(10, 45))
    response.raise_for_status()
    return response


def get_soup(url):
    return BeautifulSoup(get_response(url).content, "html.parser")


def links(cell, service_url):
    return [
        {
            "name": link.get_text(" ", strip=True),
            "reference_href": urljoin(service_url, str(link["href"])),
        }
        for link in cell.find_all("a", href=True)
    ]


def merge_links(target, values):
    for value in values:
        if value not in target:
            target.append(value)


def scrape_service_actions(service_url, prefix):
    soup = get_soup(service_url)
    actions: dict[str, dict] = {}
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue
        headers = [
            cell.get_text(" ", strip=True) for cell in rows[0].find_all(["th", "td"])
        ]
        if not headers or headers[0] != "Actions":
            continue
        columns = {name: i for i, name in enumerate(headers)}
        required = {"Actions", "Description", "Access level", "Condition keys"}
        resource_column = next(
            (i for i, name in enumerate(headers) if name.startswith("Resource types")),
            None,
        )
        if not required <= columns.keys() or resource_column is None:
            raise ValueError(f"Unsupported action table at {service_url}: {headers}")
        spans: dict[int, tuple[Tag, int]] = {}
        for row in rows[1:]:
            cells: dict[int, Tag] = {}
            next_spans: dict[int, tuple[Tag, int]] = {}
            for column, (cell, remaining) in spans.items():
                cells[column] = cell
                if remaining > 1:
                    next_spans[column] = (cell, remaining - 1)
            column = 0
            for cell in row.find_all("td", recursive=False):
                while column in cells:
                    column += 1
                cells[column] = cell
                remaining = int(str(cell.get("rowspan", "1"))) - 1
                if remaining:
                    next_spans[column] = (cell, remaining)
                column += 1
            spans = next_spans
            if len(cells) != len(headers):
                raise ValueError(f"Incomplete action row at {service_url}")
            action_cell = cells[columns["Actions"]]
            name = (
                action_cell.get_text(" ", strip=True)
                .replace("[permission only]", "")
                .strip()
            )
            anchor = action_cell.find(id=True)
            if not re.fullmatch(r"[A-Za-z0-9-]+", name) or anchor is None:
                raise ValueError(f"Invalid action at {service_url}: {name}")
            action = actions.setdefault(
                name,
                {
                    "action_name": f"{prefix}:{name}",
                    "description": cells[columns["Description"]].get_text(
                        " ", strip=True
                    ),
                    "access_level": cells[columns["Access level"]].get_text(
                        " ", strip=True
                    ),
                    "url": f"{service_url}#{anchor['id']}",
                    "resource_types": [],
                    "condition_keys": [],
                },
            )
            merge_links(
                action["resource_types"], links(cells[resource_column], service_url)
            )
            merge_links(
                action["condition_keys"],
                links(cells[columns["Condition keys"]], service_url),
            )
    if not actions:
        raise ValueError(f"No action tables found at {service_url}")
    return actions


def fetch_service(entry, pages):
    prefix = entry["service"]
    reference = get_response(entry["url"]).json()
    if reference.get("Name") != prefix or not reference.get("Actions"):
        raise ValueError(f"Invalid JSON reference for {prefix}")
    expected = {action["Name"] for action in reference["Actions"]}
    if len(expected) != len(reference["Actions"]):
        raise ValueError(f"Duplicate actions in JSON reference for {prefix}")
    actions: dict[str, dict] = {}
    for _name, url in pages:
        for name, action in scrape_service_actions(url, prefix).items():
            if name in actions:
                merge_links(actions[name]["resource_types"], action["resource_types"])
                merge_links(actions[name]["condition_keys"], action["condition_keys"])
                if action["description"] not in actions[name]["description"]:
                    actions[name]["description"] += " " + action["description"]
            else:
                actions[name] = action
    missing = expected - actions.keys()
    if missing:
        raise ValueError(
            f"Missing documentation for {prefix}: {', '.join(sorted(missing))}"
        )
    # Include permission-only actions documented in HTML as well as the JSON inventory.
    return prefix, {
        "serviceName": pages[0][0],
        "service_prefix": prefix,
        "reference_url": pages[0][1],
        "actions": actions,
    }


def scrape_iam_actions(num_services=None, num_workers=10):
    inventory = get_response(SERVICE_LIST_URL).json()
    if not isinstance(inventory, list) or not inventory:
        raise ValueError("AWS service inventory is empty or invalid")
    prefixes = set()
    for entry in inventory:
        prefix = entry.get("service")
        url = entry.get("url", "")
        if (
            not isinstance(prefix, str)
            or not re.fullmatch(r"[a-z0-9-]+", prefix)
            or prefix in prefixes
        ):
            raise ValueError("Invalid or duplicate service prefix in AWS inventory")
        if not url.startswith("https://servicereference.us-east-1.amazonaws.com/v1/"):
            raise ValueError(f"Unexpected reference URL for {prefix}")
        prefixes.add(prefix)
    pages: dict[str, list[tuple[str, str]]] = {}
    soup = get_soup(BASE_URL + SERVICES_PAGE)
    for link in soup.select("div.highlights li a[href]"):
        name = link.get_text(" ", strip=True)
        match = re.search(r"\(([^()]+)\)$", name)
        if match:
            url = urljoin(BASE_URL, str(link["href"]))
            if not url.startswith(BASE_URL + "list_"):
                raise ValueError(f"Unexpected documentation URL: {url}")
            pages.setdefault(match[1], []).append((name[: match.start()].strip(), url))
    if prefixes - pages.keys():
        raise ValueError(
            f"Missing service pages: {', '.join(sorted(prefixes - pages.keys()))}"
        )
    if pages.keys() - prefixes:
        raise ValueError(
            f"Services absent from JSON inventory: {', '.join(sorted(pages.keys() - prefixes))}"
        )
    if num_services:
        inventory = sorted(inventory, key=lambda entry: entry["service"])[:num_services]
    result = {}
    with ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = [
            executor.submit(fetch_service, entry, pages[entry["service"]])
            for entry in inventory
        ]
        for future in as_completed(futures):
            prefix, service = future.result()
            result[prefix] = service
    return result


def validate_catalog(catalog):
    if not isinstance(catalog, dict) or not catalog:
        raise ValueError("IAM catalog is empty or invalid")
    total = 0
    seen = set()
    for service in catalog.values():
        prefix = service["service_prefix"]
        if (
            not re.fullmatch(r"[a-z0-9-]+", prefix)
            or prefix in seen
            or not service["actions"]
        ):
            raise ValueError(f"Invalid or duplicate service: {prefix}")
        seen.add(prefix)
        for name, action in service["actions"].items():
            if (
                not re.fullmatch(r"[A-Za-z0-9-]+", name)
                or action["action_name"] != f"{prefix}:{name}"
            ):
                raise ValueError(f"Invalid action identity for {prefix}:{name}")
            levels = {level.strip() for level in action["access_level"].split(",")}
            if not action["description"] or not levels <= ACCESS_LEVELS:
                raise ValueError(f"Invalid action metadata for {prefix}:{name}")
            for url in [
                action["url"],
                *[
                    link["reference_href"]
                    for field in ["resource_types", "condition_keys"]
                    for link in action[field]
                ],
            ]:
                parsed = urlparse(url)
                if parsed.scheme != "https" or parsed.hostname != "docs.aws.amazon.com":
                    raise ValueError(f"Unexpected documentation URL: {url}")
            total += 1
    return total


def write_catalog(catalog, output):
    total = validate_catalog(catalog)
    if output.exists():
        previous = json.loads(output.read_text())
        if previous:
            validate_catalog(previous)
            old_services = {service["service_prefix"] for service in previous.values()}
            if old_services - catalog.keys():
                raise ValueError(
                    "Update would remove services; review AWS inventory before replacing the catalog"
                )
            old_total = sum(len(service["actions"]) for service in previous.values())
            if total < old_total * 0.95:
                raise ValueError(
                    "Update would remove more than 5% of actions; preserving the existing catalog"
                )
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=output.parent, delete=False
        ) as file:
            temporary = Path(file.name)
            json.dump(catalog, file, sort_keys=True, indent=2)
            file.write("\n")
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    print(f"Saved {total} actions across {len(catalog)} services to {output}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", default="snippets/iam-actions.json", help="Catalog output path"
    )
    parser.add_argument("--workers", type=int, default=10)
    parser.add_argument(
        "--test",
        type=int,
        help="Limit services for a development scrape (requires a separate output)",
    )
    parser.add_argument(
        "--validate",
        action="store_true",
        help="Validate an existing catalog without fetching AWS data",
    )
    args = parser.parse_args()
    if args.workers < 1 or (args.test is not None and args.test < 1):
        parser.error("Worker and service counts must be positive")
    if args.test and args.output == "snippets/iam-actions.json":
        parser.error("Use --output with --test to preserve the production catalog")
    try:
        output = Path(args.output)
        if args.validate:
            total = validate_catalog(json.loads(output.read_text()))
            print(f"Validated {total} IAM actions in {output}")
        else:
            write_catalog(scrape_iam_actions(args.test, args.workers), output)
    except (
        requests.RequestException,
        ValueError,
        KeyError,
        TypeError,
        AttributeError,
        OSError,
    ) as error:
        parser.exit(1, f"IAM catalog update failed: {error}\n")


if __name__ == "__main__":
    main()
