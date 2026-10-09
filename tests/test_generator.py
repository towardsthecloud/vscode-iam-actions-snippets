"""Exercise the updater's CLI with AWS responses at the HTTP boundary."""

import contextlib
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

import requests

SPEC = importlib.util.spec_from_file_location(
    "generator",
    pathlib.Path(__file__).resolve().parents[1] / "src/update-iam-action-snippets.py",
)
assert SPEC is not None
assert SPEC.loader is not None
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)

INDEX = (
    '<div class="highlights"><li><a href="list_s3.html">Amazon S3 (s3)</a></li></div>'
)
SERVICE = """<h1 class="topictitle">Actions, resources, and condition keys for Amazon S3</h1>
<p>Amazon S3 (service prefix: <code class="code">s3</code>)</p>
<div class="table-container"><table><tr><th>Operation</th></tr><tr><td>GetObject</td></tr></table></div>
<div class="table-container"><table>
<tr><th>Actions</th><th>Description</th><th>Resource types (*required)</th><th>Condition keys</th><th>Access level</th></tr>
<tr><td rowspan="2"><span id="list_s3-action-GetObject"></span><a href="https://docs.aws.amazon.com/api/GetObject">GetObject</a></td>
<td rowspan="2">Grants permission to read an object</td><td><a href="#object">object*</a></td>
<td><a href="#tls">s3:TlsVersion</a></td><td rowspan="2">Read</td></tr>
<tr><td><a href="#accesspointobject">accesspointobject</a></td><td></td></tr>
</table></div>
<div class="table-container"><table>
<tr><th>Actions</th><th>Description</th><th>Resource types (*required)</th><th>Condition keys</th><th>Access level</th></tr>
<tr><td><span id="list_s3-action-InitiateReplication"></span>InitiateReplication [permission only]</td>
<td>Grants permission to initiate replication</td><td><a href="#object">object*</a></td><td></td><td>Write</td></tr>
</table></div>"""


def aws_response(url, **_kwargs):
    bodies = {
        "https://servicereference.us-east-1.amazonaws.com/v1/service-list.json": json.dumps(
            [
                {
                    "service": "s3",
                    "url": "https://servicereference.us-east-1.amazonaws.com/v1/s3/s3.json",
                }
            ]
        ),
        "https://servicereference.us-east-1.amazonaws.com/v1/s3/s3.json": json.dumps(
            {
                "Name": "s3",
                "Actions": [{"Name": "GetObject"}, {"Name": "InitiateReplication"}],
            }
        ),
        generator.BASE_URL + generator.SERVICES_PAGE: INDEX,
        generator.BASE_URL + "list_s3.html": SERVICE,
    }
    response = requests.Response()
    response.status_code = 200
    response._content = bodies[url].encode()
    return response


def invoke_cli(response, errors=None):
    with (
        patch("sys.argv", ["update-iam-action-snippets.py"]),
        patch("requests.Session.get", side_effect=response),
        contextlib.redirect_stdout(io.StringIO()),
        contextlib.redirect_stderr(errors if errors is not None else io.StringIO()),
    ):
        generator.main()


class GeneratorCliTest(unittest.TestCase):
    def test_failed_updates_preserve_a_previous_valid_catalog(self):
        for failure, reason in [
            ("service_http", "503"),
            ("missing_metadata", "Missing documentation for s3: PutObject"),
            ("coverage_drop", "remove more than 5%"),
            ("atomic_write", "simulated disk failure"),
        ]:
            with (
                self.subTest(failure=failure),
                tempfile.TemporaryDirectory() as directory,
                contextlib.chdir(directory),
            ):
                invoke_cli(aws_response)
                output = pathlib.Path("snippets/iam-actions.json")
                previous = output.read_bytes()

                def failed_response(url, failure=failure, **kwargs):
                    response = aws_response(url, **kwargs)
                    if url.endswith("/s3.json"):
                        if failure == "service_http":
                            response.status_code = 503
                        elif failure == "missing_metadata":
                            body = response.json()
                            body["Actions"].append({"Name": "PutObject"})
                            response._content = json.dumps(body).encode()
                        elif failure == "coverage_drop":
                            body = response.json()
                            body["Actions"] = [{"Name": "GetObject"}]
                            response._content = json.dumps(body).encode()
                    elif url.endswith("list_s3.html") and failure == "coverage_drop":
                        response._content = SERVICE[
                            : SERVICE.rindex('<div class="table-container"><table>')
                        ].encode()
                    return response

                errors = io.StringIO()
                filesystem = (
                    patch("os.replace", side_effect=OSError("simulated disk failure"))
                    if failure == "atomic_write"
                    else contextlib.nullcontext()
                )
                with filesystem, self.assertRaises(SystemExit) as raised:
                    invoke_cli(failed_response, errors)
                self.assertEqual(raised.exception.code, 1)
                self.assertIn(reason, errors.getvalue())
                self.assertEqual(output.read_bytes(), previous)

    def test_uses_canonical_reference_links_for_glue_schema_actions(self):
        def glue_response(url, **kwargs):
            response = aws_response(url.replace("glue", "s3"), **kwargs)
            response._content = (
                response.content.replace(b"s3", b"glue")
                .replace(b"GetObject", b"CheckSchemaVersionValidity")
                .replace(b"InitiateReplication", b"QuerySchemaVersionMetadata")
            )
            return response

        with tempfile.TemporaryDirectory() as directory, contextlib.chdir(directory):
            invoke_cli(glue_response)
            catalog = json.loads(pathlib.Path("snippets/iam-actions.json").read_text())
            self.assertEqual(
                catalog["glue"]["actions"]["CheckSchemaVersionValidity"]["url"],
                generator.BASE_URL
                + "list_glue.html#list_glue-action-CheckSchemaVersionValidity",
            )
            self.assertEqual(
                catalog["glue"]["actions"]["QuerySchemaVersionMetadata"]["url"],
                generator.BASE_URL
                + "list_glue.html#list_glue-action-QuerySchemaVersionMetadata",
            )

    def test_preserves_combined_access_levels(self):
        def response_with_combined_levels(url, **kwargs):
            response = aws_response(url, **kwargs)
            response._content = response.content.replace(
                b">Write</td>", b">Tagging, Write</td>"
            )
            return response

        with tempfile.TemporaryDirectory() as directory:
            with (
                patch("sys.argv", ["update-iam-action-snippets.py"]),
                patch(
                    "requests.Session.get", side_effect=response_with_combined_levels
                ),
                contextlib.chdir(directory),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                generator.main()
            catalog = json.loads(
                (pathlib.Path(directory) / "snippets/iam-actions.json").read_text()
            )
            self.assertEqual(
                catalog["s3"]["actions"]["InitiateReplication"]["access_level"],
                "Tagging, Write",
            )

    def test_keeps_hyphenated_action_names(self):
        def response_with_hyphenated_action(url, **kwargs):
            response = aws_response(url, **kwargs)
            response._content = response.content.replace(
                b"InitiateReplication", b"AssociateViaAWSService-EventsAndStates"
            )
            return response

        with tempfile.TemporaryDirectory() as directory:
            with (
                patch("sys.argv", ["update-iam-action-snippets.py"]),
                patch(
                    "requests.Session.get", side_effect=response_with_hyphenated_action
                ),
                contextlib.chdir(directory),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                generator.main()
            catalog = json.loads(
                (pathlib.Path(directory) / "snippets/iam-actions.json").read_text()
            )
            self.assertIn(
                "AssociateViaAWSService-EventsAndStates", catalog["s3"]["actions"]
            )

    def test_generates_complete_enriched_inventory_from_current_aws_tables(self):
        with tempfile.TemporaryDirectory() as directory:
            with (
                patch("sys.argv", ["update-iam-action-snippets.py"]),
                patch("requests.get", side_effect=aws_response),
                patch("requests.Session.get", side_effect=aws_response),
                contextlib.chdir(directory),
                contextlib.redirect_stdout(io.StringIO()),
            ):
                generator.main()
            catalog = json.loads(
                (pathlib.Path(directory) / "snippets/iam-actions.json").read_text()
            )
            actions = catalog["s3"]["actions"]
            self.assertEqual(set(actions), {"GetObject", "InitiateReplication"})
            self.assertEqual(
                actions["GetObject"]["description"],
                "Grants permission to read an object",
            )
            self.assertEqual(actions["GetObject"]["access_level"], "Read")
            self.assertEqual(
                [r["name"] for r in actions["GetObject"]["resource_types"]],
                ["object*", "accesspointobject"],
            )
            self.assertEqual(
                actions["InitiateReplication"]["url"],
                generator.BASE_URL + "list_s3.html#list_s3-action-InitiateReplication",
            )

    def test_empty_inventory_fails_without_replacing_existing_catalog(self):
        response = requests.Response()
        response.status_code = 200
        response._content = b"[]"
        with tempfile.TemporaryDirectory() as directory:
            output = pathlib.Path(directory) / "snippets/iam-actions.json"
            output.parent.mkdir()
            previous = b'{"last-good-catalog": true}'
            output.write_bytes(previous)
            with (
                patch("sys.argv", ["update-iam-action-snippets.py"]),
                patch("requests.get", return_value=response),
                patch("requests.Session.get", return_value=response),
                contextlib.chdir(directory),
                contextlib.redirect_stdout(io.StringIO()),
                contextlib.redirect_stderr(io.StringIO()),
                self.assertRaises(SystemExit) as raised,
            ):
                generator.main()
            self.assertNotEqual(raised.exception.code, 0)
            self.assertEqual(output.read_bytes(), previous)
