# AWS IAM Actions Snippets for VS Code

This AWS IAM Actions Snippets extension equips Visual Studio Code with comprehensive snippets for all AWS IAM actions. It's your essential tool for efficient and accurate IAM policy development.

---

<!-- TIP-LIST:START -->
> [!TIP]
> **Catch AWS waste before and after you deploy.**
>
> [CloudBurn](https://cloudburn.io) is a free, open-source CLI that checks your Terraform and CloudFormation for costly patterns before deploy, then finds the waste already running in your AWS account. Run it locally or in CI.
>
> <a href="https://github.com/towardsthecloud/cloudburn"><img alt="Get the free CloudBurn CLI on GitHub" src="https://img.shields.io/badge/Get%20the%20free%20CLI-GitHub-brightgreen.svg?style=for-the-badge&logo=github"/></a>
>
> Want it managed across your AWS accounts? [CloudBurn Platform](https://cloudburn.io) runs it for you and keeps scan results in your own account. Join the waitlist for 30% off.
<!-- TIP-LIST:END -->

## Features

1. **Comprehensive Coverage**: Offers snippets for **all** AWS IAM actions available across various AWS services.
2. **Auto-completion**: Provides intelligent auto-completion for IAM actions as you type.
3. **Documentation Links**: Quick access to AWS documentation for each IAM action directly from the snippet.
4. **Flexible Format Support**: Supports IAM policies in JSON, but also IAM Policies defined in CloudFormation templates (`.json, .yaml`), and Terraform files (`.tf`).
5. **Up-to-Date**: Regularly updated to reflect the latest AWS IAM actions.
6. **Smart Hover Information**: Supports case-insensitive action names and `*` / `?` wildcards. Large matches show the total count and the first 100 actions.

## Usage

1. Install the AWS IAM Actions Snippets extension in VS Code.
2. Open a JSON, JSONC, YAML, Terraform, TypeScript, or Python file containing an IAM policy.
3. Start typing an IAM action name (e.g., `s3:Get`) in the appropriate place in your policy.
4. The extension suggests service prefixes first, then filters actions as you type (for example, `s3:Ge`). Completions support `Action` / `NotAction` values and CDK / Terraform action arrays.
5. Select the desired action to insert it into your policy.

Example of auto-completion in action:

![IAM Actions Snippets Autocomplete Example](https://raw.githubusercontent.com/dannysteenman/vscode-iam-actions-snippets/main/images/iam-actions-snippets-autocomplete-example.gif)

and an example of the hover information:

![IAM Actions Snippets Hover Example](https://raw.githubusercontent.com/dannysteenman/vscode-iam-actions-snippets/main/images/iam-actions-snippets-hover-example.gif)

> **Note:** If auto-completion doesn't trigger automatically, press `Ctrl+Space` (or `Cmd+Space` on macOS) to manually invoke IntelliSense.

## Requirements and development

Requires VS Code 1.85.0 or newer. IAM data ships with the extension; completion and hover work offline.

VS Code API typings stay pinned to the minimum supported editor version. Update the compiler and other development dependencies independently to retain compatibility with that editor.

CloudFormation `.template` files open as JSON by default. For YAML templates with that extension, select YAML in the editor's language mode.

The updater checks AWS's JSON service inventory, enriches actions from the Service Authorization Reference, and merges documentation pages sharing a service prefix. Empty inventories, missing metadata, failed requests, removed services, and action-count drops above 5% fail the update before the existing catalog is replaced. Review legitimate service removals or large reductions before rebuilding the catalog.

Use Node 24 (see `.nvmrc`) and Python 3.14:

```sh
npm ci
uv venv --python 3.14
uv pip install --python .venv/bin/python -r src/requirements.txt
source .venv/bin/activate
npm run test:python
npm run validate:catalog
npm test -- 1.85.0
npm test -- stable
```

Each `npm test` builds and validates the VSIX, then tests the unpacked package in an isolated VS Code extension host. Reports are saved in `.vscode-test/results/`. On headless Linux, use `xvfb-run -a npm test -- <version>`.

To update the catalog:

```sh
python src/update-iam-action-snippets.py --workers 12
```

For a limited development scrape, use a separate output: `--test 3 --output .vscode-test/sample-actions.json`.

Pull requests validate the catalog, updater, and packaged extension on minimum and stable VS Code. Releases run the same checks, then publish the tested VSIX to both registries. Failed registry jobs can be rerun independently using the retained release artifact.

---

## Related IAM extensions

- [AWS IAM Service Principal Snippets](https://marketplace.visualstudio.com/items?itemName=dannysteenman.iam-service-principal-snippets) completes documented service principals in trust policies and CDK roles.
- [AWS IAM Policy Debugger](https://github.com/towardsthecloud/vscode-iam-policy-debugger) validates policies, explains request matches and saves regression scenarios in VS Code’s Testing panel. It is an unpublished development preview; build a local VSIX to try it.

## Support

If you have a feature request or an issue, please let me know on [Github](https://github.com/towardsthecloud/vscode-iam-actions-snippets/issues)

## Author

[Danny Steenman](https://towardsthecloud.com/about)

[![](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/towardsthecloud)
[![](https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/dannysteenman)
[![](https://img.shields.io/badge/GitHub-2b3137?style=for-the-badge&logo=github&logoColor=white)](https://github.com/towardsthecloud)
