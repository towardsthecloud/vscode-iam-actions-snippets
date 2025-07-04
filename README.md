# AWS IAM Actions Snippets for VS Code

[![](https://img.shields.io/visual-studio-marketplace/v/dannysteenman.iam-actions-snippets?color=374151&label=Visual%20Studio%20Marketplace&labelColor=000&logo=visual-studio-code&logoColor=0098FF)](https://marketplace.visualstudio.com/items?itemName=dannysteenman.iam-actions-snippets)
[![](https://img.shields.io/visual-studio-marketplace/v/dannysteenman.iam-actions-snippets?color=374151&label=Open%20VSX%20Registry&labelColor=000&logo=data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB2aWV3Qm94PSI0LjYgNSA5Ni4yIDEyMi43IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxwYXRoIGQ9Ik0zMCA0NC4yTDUyLjYgNUg3LjN6TTQuNiA4OC41aDQ1LjNMMjcuMiA0OS40em01MSAwbDIyLjYgMzkuMiAyMi42LTM5LjJ6IiBmaWxsPSIjYzE2MGVmIi8+CiAgPHBhdGggZD0iTTUyLjYgNUwzMCA0NC4yaDQ1LjJ6TTI3LjIgNDkuNGwyMi43IDM5LjEgMjIuNi0zOS4xem01MSAwTDU1LjYgODguNWg0NS4yeiIgZmlsbD0iI2E2MGVlNSIvPgo8L3N2Zz4=&logoColor=0098FF)](https://open-vsx.org/extension/dannysteenman/iam-actions-snippets)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/dannysteenman.iam-actions-snippets 'Currently Installed')](https://marketplace.visualstudio.com/items?itemName=dannysteenman.iam-actions-snippets)
[![Rating](https://img.shields.io/visual-studio-marketplace/stars/dannysteenman.iam-actions-snippets)](https://marketplace.visualstudio.com/items?itemName=dannysteenman.iam-actions-snippets)

This AWS IAM Actions Snippets extension equips Visual Studio Code with comprehensive snippets for all AWS IAM actions. It's your essential tool for efficient and accurate IAM policy development.

---

<!-- TIP-LIST:START -->
> [!TIP]
> **[Towards the Cloud](https://towardsthecloud.com/about) eliminates AWS complexity so you ship faster with confidence, cut costs by 30%, and become compliant.**
>
> Sounds too good to be true? We'll assess your AWS account for free and report exactly where you stand. You'll receive a report with security findings and cost optimization opportunities. After that you can decide whether to fix these findings yourself or let us handle it. No strings attached.
>
> <a href="https://cal.com/towardsthecloud/aws-account-review"><img alt="Book a Free AWS Account Review" src="https://img.shields.io/badge/Book%20A%20Free%20AWS%20Account%20Review-success.svg?style=for-the-badge"/></a>
>
> <details>
> <summary>☁️ <strong>Discover how we cut AWS costs by 30% and accelerate SOC 2 compliance...</strong></summary>
> <br/>
>
> ### AWS complexity builds faster than you realize
>
> What starts as simple deployment quickly spirals into inefficient architectures costing 40-60% more than needed, security blind spots risking customer data, and team burnout from operations instead of product development.
>
> **Traditional consultancies prioritize billable hours over outcomes, then disappear after setup. We do the opposite...**
>
> ---
>
> ### We provide a complete package, so you deploy faster with confidence on AWS Cloud
>
> - ✅ **[Compliant multi-account Landing Zone](https://towardsthecloud.com/services/aws-landing-zone)**:
>   - Provisions AWS accounts with security guardrails out of the box - 100% [CIS benchmark compliant](https://docs.aws.amazon.com/securityhub/latest/userguide/cis-aws-foundations-benchmark.html)
>   - Secure Single Sign-On (SSO) for clean user access management
>   - Everything is built using AWS CDK ensuring consistency, version control, and repeatable deployments
>   - See what features are already included in our landing zone on our [public roadmap](https://github.com/towardsthecloud/aws-cdk-landing-zone-roadmap?tab=readme-ov-file#features)
> - ✅ **Off-the-shelf compliant CDK components**: Develop secure infra quicker without reinventing the wheel
> - ✅ **Complete CI/CD with easy rollbacks**: Deploy more frequently because of IaC safety
> - ✅ **Quarterly checks**: Proactively receive [Cost Optimization assessments](https://towardsthecloud.com/services/aws-cost-optimization) + [Security Reviews](https://towardsthecloud.com/services/aws-security-review)
> - ✅ **Fractional Cloud Engineer**: On-demand access to a decade of AWS Cloud experience to help you use best practices
>
> ---
>
> ### What results can you expect when you partner with us:
>
> - **30% Lower AWS Bill**: Proactive quarterly reviews catch overspending before it happens [(30-60% documented savings)](https://towardsthecloud.com/services/aws-cost-optimization#case-study)
> - **Accelerate SOC 2/HIPAA compliance**: Our Landing Zone automatically sets up security guardrails on your AWS accounts with 100% CIS compliance from day one
> - **Easily stay compliant**: Our automated monitoring and proactive quarterly security reviews give you control so yearly audits are smooth, not stressful
> - **Your Team Ships Faster**: Our Pre-built secure infrastructure components let your team focus on product, not AWS
> - **Save on hiring costs**: Access expert Cloud knowledge through our [flexible retainer](https://towardsthecloud.com/pricing) instead of committing to a full-time Cloud Engineer
>
> **Proof:** Y Combinator startup Accolade's founder on how our Landing Zone [accelerated their SOC 2 certification](https://towardsthecloud.com/blog/aws-landing-zone-case-study-accolade):
>
> *"Danny's solution and AWS expertise stood out with comprehensive accelerators, documentation, and clearly articulated design principles. **We achieved a perfect security score in days, not months.**"* — Galen Simmons, CEO
>
> </details>
<!-- TIP-LIST:END -->

## Features

1. **Comprehensive Coverage**: Offers snippets for **all** AWS IAM actions available across various AWS services.
2. **Auto-completion**: Provides intelligent auto-completion for IAM actions as you type.
3. **Documentation Links**: Quick access to AWS documentation for each IAM action directly from the snippet.
4. **Flexible Format Support**: Supports IAM policies in JSON, but also IAM Policies defined in CloudFormation templates (`.json, .yaml`), and Terraform files (`.tf`).
5. **Up-to-Date**: Regularly updated to reflect the latest AWS IAM actions.
6. **Smart Hover Information**: When hovering over wildcard actions, displays all matching IAM actions, providing a comprehensive view of the permissions covered.

## Usage

1. Install the AWS IAM Actions Snippets extension in VS Code.
2. Open or create a new `.json`, `.yml`, or `.tf` file for your IAM policy.
3. Start typing an IAM action name (e.g., `s3:Get`) in the appropriate place in your policy.
4. The extension will provide auto-completion suggestions for matching IAM actions.
5. Select the desired action to insert it into your policy.

Example of auto-completion in action:

![IAM Actions Snippets Autocomplete Example](https://raw.githubusercontent.com/dannysteenman/vscode-iam-actions-snippets/main/images/iam-actions-snippets-autocomplete-example.gif)

and an example of the hover information:

![IAM Actions Snippets Hover Example](https://raw.githubusercontent.com/dannysteenman/vscode-iam-actions-snippets/main/images/iam-actions-snippets-hover-example.gif)

> **Note:** If auto-completion doesn't trigger automatically, press `Ctrl+Space` (or `Cmd+Space` on macOS) to manually invoke IntelliSense.

---
## Support

If you have a feature request or an issue, please let me know on [Github](https://github.com/towardsthecloud/vscode-iam-actions-snippets/issues)

## Author

[Danny Steenman](https://towardsthecloud.com/about)

[![](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/company/towardsthecloud)
[![](https://img.shields.io/badge/X-000000?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/dannysteenman)
[![](https://img.shields.io/badge/GitHub-2b3137?style=for-the-badge&logo=github&logoColor=white)](https://github.com/towardsthecloud)
