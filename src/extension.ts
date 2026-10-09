import * as vscode from 'vscode';
import { Hover, MarkdownString } from 'vscode';
import { getActionContext } from './action-context';
import { IamActionMappings } from './catalog';

const languages = ['json', 'jsonc', 'yaml', 'terraform', 'typescript', 'typescriptreact', 'python'];

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('IAM Action Snippets');
  const iamActionMappings = new IamActionMappings(context.asAbsolutePath('snippets/iam-actions.json'), (message) => {
    output.appendLine(message);
    void vscode.window.showWarningMessage(
      'AWS IAM actions could not be loaded. See the IAM Action Snippets output for details.',
    );
  });
  const disposable: vscode.Disposable[] = [output];
  disposable.push(
    vscode.languages.registerCompletionItemProvider(
      languages,
      {
        async provideCompletionItems(document, position, token) {
          if (token.isCancellationRequested) return;
          const actionContext = getActionContext(document, position);
          if (!actionContext) return;
          try {
            const matches = await iamActionMappings.getSuggestions(actionContext.prefix);
            if (token.isCancellationRequested) return;
            return matches.map((match) => {
              const name = typeof match === 'string' ? match : match.action_name;
              const item = new vscode.CompletionItem(
                name,
                typeof match === 'string' ? vscode.CompletionItemKind.Module : vscode.CompletionItemKind.Value,
              );
              item.range = actionContext.range;
              item.filterText = name;
              item.detail =
                typeof match === 'string'
                  ? 'AWS service prefix'
                  : `IAM Action: ${name.split(':')[1]} (${match.access_level})`;
              const quote = actionContext.quote || (document.languageId.startsWith('typescript') ? "'" : '\"');
              const servicePrefix = typeof match === 'string';
              item.insertText = actionContext.quote
                ? name + (actionContext.closedQuote || servicePrefix ? '' : quote)
                : document.languageId === 'yaml'
                  ? name
                  : `${quote}${name}${servicePrefix ? '' : quote}`;
              if (!servicePrefix && actionContext.needsComma && !actionContext.closedQuote) item.insertText += ',';
              if (!servicePrefix && actionContext.commaPosition)
                item.additionalTextEdits = [vscode.TextEdit.insert(actionContext.commaPosition, ',')];
              if (servicePrefix)
                item.command = { title: 'Suggest IAM actions', command: 'editor.action.triggerSuggest' };
              return item;
            });
          } catch {
            return [];
          }
        },
        async resolveCompletionItem(item, token) {
          if (token.isCancellationRequested) return item;
          try {
            const action = await iamActionMappings.getIamActionData(String(item.label));
            if (action && !token.isCancellationRequested)
              item.documentation = new vscode.MarkdownString()
                .appendText(action.description)
                .appendMarkdown(`\n\n[View AWS documentation](${linkUrl(action.url)})`);
          } catch {
            /* The catalog loader reports failures once and retries on the next request. */
          }
          return item;
        },
      },
      '\"',
      "'",
      ':',
    ),
  );
  disposable.push(
    vscode.languages.registerHoverProvider(languages, {
      async provideHover(document, position, token) {
        if (token.isCancellationRequested) return;
        const range = document.getWordRangeAtPosition(position, /[A-Za-z0-9*?-]+:[A-Za-z0-9*?-]+|\*/);
        if (!range) return;
        const word = document.getText(range);
        if (word === '*' && !getActionContext(document, position)) return;
        try {
          const content = new MarkdownString();
          if (/[?*]/.test(word)) {
            const matches = await iamActionMappings.getMatchingActions(word);
            if (!matches.length || token.isCancellationRequested) return;
            content.appendMarkdown(
              `### Matching IAM actions for ${escapeMarkdown(word)}\n\n| Action | Description | Access level |\n|:---|:---|:---|\n`,
            );
            for (const action of matches.slice(0, 100))
              content.appendMarkdown(
                `| [${escapeMarkdown(action.action_name)}](${linkUrl(action.url)}) | ${escapeMarkdown(action.description)} | ${escapeMarkdown(action.access_level)} |\n`,
              );
            content.appendMarkdown(`\n**Total matching actions:** ${matches.length}`);
            if (matches.length > 100)
              content.appendMarkdown(
                '\n\nShowing the first 100 matching actions. Narrow the wildcard to see a smaller set.',
              );
          } else {
            const action = await iamActionMappings.getIamActionData(word);
            if (!action || token.isCancellationRequested) return;
            content.appendMarkdown(
              `**[${escapeMarkdown(action.action_name)}](${linkUrl(action.url)})** (${escapeMarkdown(action.access_level)})\n\n`,
            );
            content.appendText(action.description);
            for (const [title, links] of [
              ['Resources', action.resource_types],
              ['Condition keys', action.condition_keys],
            ] as const) {
              if (links.length)
                content.appendMarkdown(
                  `\n\n**${title}:** ${links.map((link) => `[${escapeMarkdown(link.name)}](${linkUrl(link.reference_href)})`).join(', ')}`,
                );
            }
          }
          return new Hover(content, range);
        } catch {
          return;
        }
      },
    }),
  );
  context.subscriptions.push(...disposable);
}

function escapeMarkdown(text: string): string {
  return text.replace(/[\n\r]+/g, ' ').replace(/[\\`*_[\]<>|]/g, '\\$&');
}

function linkUrl(url: string): string {
  return encodeURI(url).replace(/\(/g, '%28').replace(/\)/g, '%29');
}
