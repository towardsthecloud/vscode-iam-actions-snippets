import importlib.util
import pathlib
import unittest


MODULE_PATH = (
    pathlib.Path(__file__).resolve().parents[1]
    / "src"
    / "update-iam-action-snippets.py"
)
SPEC = importlib.util.spec_from_file_location(
    "update_iam_action_snippets",
    MODULE_PATH,
)
assert SPEC is not None
assert SPEC.loader is not None
update_iam_action_snippets = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(update_iam_action_snippets)


class NormalizeActionUrlTest(unittest.TestCase):
    def test_rewrites_glue_schema_registry_urls_flagged_by_openvsx(self):
        actions = {
            "CheckSchemaVersionValidity": (
                "https://docs.aws.amazon.com/service-authorization/latest/"
                "reference/list_awsglue.html#awsglue-CheckSchemaVersionValidity"
            ),
            "QuerySchemaVersionMetadata": (
                "https://docs.aws.amazon.com/service-authorization/latest/"
                "reference/list_awsglue.html#awsglue-QuerySchemaVersionMetadata"
            ),
        }

        for action_name, expected_url in actions.items():
            with self.subTest(action_name=action_name):
                source_url = (
                    "https://docs.aws.amazon.com/glue/latest/dg/"
                    "aws-glue-api-schema-registry-api.html"
                    f"#aws-glue-api-schema-registry-api-{action_name}"
                )

                normalized_url = update_iam_action_snippets.normalize_action_url(
                    service_prefix="glue",
                    action_name=action_name,
                    action_url=source_url,
                )

                self.assertEqual(normalized_url, expected_url)

    def test_leaves_unrelated_urls_unchanged(self):
        source_url = (
            "https://docs.aws.amazon.com/appstream2/latest/APIReference/"
            "API_CreateFleet.html"
        )

        normalized_url = update_iam_action_snippets.normalize_action_url(
            service_prefix="appstream",
            action_name="CreateFleet",
            action_url=source_url,
        )

        self.assertEqual(normalized_url, source_url)
