import { useMemo, type ReactNode } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const inlinePattern = /(`[^`\n]+`|!?\[[^\]]*\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_)/g;
const headingPattern = /^ {0,3}(#{1,6})[ \t]+(.+?)\s*#*\s*$/;
const listPattern = /^( {0,6})([-+*]|\d+[.)])\s+(.+)$/;
const fencePattern = /^ {0,3}(`{3,}|~{3,})/;
const rulePattern = /^ {0,3}(?:-{3,}|\*\s*\*\s*\*[*\s]*|_\s*_\s*_[\s_]*)\s*$/;
const tableRulePattern = /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/;

function unescapeMarkdown(value: string): string {
  return value.replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, '$1');
}

function renderInline(value: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of value.matchAll(inlinePattern)) {
    const index = match.index ?? 0;
    let escapes = 0;
    for (let previous = index - 1; previous >= cursor && value[previous] === '\\'; previous--) escapes += 1;
    if (escapes % 2 === 1) continue;
    if (index > cursor) parts.push(unescapeMarkdown(value.slice(cursor, index)));
    const token = match[0];
    const key = `${index}-${parts.length}`;
    if (token.startsWith('`')) {
      parts.push(<Text key={key} style={styles.inlineCode}>{token.slice(1, -1)}</Text>);
    } else if (token.startsWith('![')) {
      const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token);
      parts.push(<Text key={key} style={styles.imageLabel}>[Image: {image?.[1] || 'untitled'}]</Text>);
    } else if (token.startsWith('[')) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)$/.exec(token);
      if (!link) {
        parts.push(token);
      } else {
        const url = link[2];
        const canOpen = /^(https?:\/\/|mailto:)/i.test(url);
        parts.push(
          <Text
            key={key}
            style={styles.link}
            accessibilityRole={canOpen ? 'link' : undefined}
            onPress={canOpen ? () => { void Linking.openURL(url).catch(() => {}); } : undefined}
          >
            {renderInline(link[1])}
          </Text>,
        );
      }
    } else if (token.startsWith('**') || token.startsWith('__')) {
      parts.push(<Text key={key} style={styles.bold}>{renderInline(token.slice(2, -2))}</Text>);
    } else if (token.startsWith('~~')) {
      parts.push(<Text key={key} style={styles.strike}>{renderInline(token.slice(2, -2))}</Text>);
    } else {
      parts.push(<Text key={key} style={styles.italic}>{renderInline(token.slice(1, -1))}</Text>);
    }
    cursor = index + token.length;
  }
  if (cursor < value.length) parts.push(unescapeMarkdown(value.slice(cursor)));
  return parts;
}

function splitTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function startsBlock(lines: string[], index: number): boolean {
  const line = lines[index];
  return headingPattern.test(line) || listPattern.test(line) || fencePattern.test(line) ||
    rulePattern.test(line) || /^ {0,3}>/.test(line) ||
    (line.includes('|') && tableRulePattern.test(lines[index + 1] ?? ''));
}

function renderBlocks(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    const key = index;
    const setext = /^ {0,3}(=+|-+)\s*$/.exec(lines[index + 1] ?? '');
    if (setext && !startsBlock(lines, index)) {
      blocks.push(<Text key={key} selectable style={[styles.heading, setext[1][0] === '=' ? styles.h1 : styles.h2]}>{renderInline(line.trim())}</Text>);
      index += 2;
      continue;
    }
    const fence = fencePattern.exec(line);
    if (fence) {
      const marker = fence[1][0];
      const closing = new RegExp(`^ {0,3}${marker}{${fence[1].length},}\\s*$`);
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !closing.test(lines[index])) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<View key={key} style={styles.codeBlock}><Text selectable style={styles.codeText}>{code.join('\n')}</Text></View>);
      continue;
    }
    const heading = headingPattern.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(<Text key={key} selectable style={[styles.heading, level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3]}>{renderInline(heading[2])}</Text>);
      index += 1;
      continue;
    }
    if (rulePattern.test(line)) {
      blocks.push(<View key={key} style={styles.rule} />);
      index += 1;
      continue;
    }
    if (line.includes('|') && tableRulePattern.test(lines[index + 1] ?? '')) {
      const rows = [splitTableRow(line)];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes('|')) rows.push(splitTableRow(lines[index++]));
      blocks.push(
        <ScrollView key={key} horizontal style={styles.tableScroll} showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.tableRow}>
                {row.map((cell, cellIndex) => (
                  <Text key={cellIndex} style={[styles.tableCell, rowIndex === 0 && styles.tableHeader]}>{renderInline(cell)}</Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>,
      );
      continue;
    }
    if (/^ {0,3}>/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^ {0,3}>/.test(lines[index])) quote.push(lines[index++].replace(/^ {0,3}> ?/, ''));
      blocks.push(<View key={key} style={styles.quote}><Text selectable style={styles.quoteText}>{renderInline(quote.join(' '))}</Text></View>);
      continue;
    }
    if (listPattern.test(line)) {
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = listPattern.exec(lines[index]);
        if (!item) break;
        let body = item[3];
        const task = /^\[([ xX])\]\s*/.exec(body);
        if (task) body = body.slice(task[0].length);
        const marker = task ? (task[1].toLowerCase() === 'x' ? '☑' : '☐')
          : /^\d/.test(item[2]) ? item[2].replace(/[.)]$/, '.') : '•';
        items.push(
          <View key={index} style={[styles.listItem, { marginLeft: Math.min(item[1].length, 6) * 4 }]}>
            <Text style={styles.listMarker}>{marker}</Text>
            <Text selectable style={styles.bodyText}>{renderInline(body)}</Text>
          </View>,
        );
        index += 1;
      }
      blocks.push(<View key={key} style={styles.list}>{items}</View>);
      continue;
    }
    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && lines[index].trim() && !startsBlock(lines, index)) paragraph.push(lines[index++].trim());
    blocks.push(<Text key={key} selectable style={styles.paragraph}>{renderInline(paragraph.join(' '))}</Text>);
  }
  return blocks;
}

export function MarkdownViewer({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => renderBlocks(markdown), [markdown]);
  return <ScrollView contentContainerStyle={styles.content}>{blocks}</ScrollView>;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 32 },
  bodyText: { flex: 1, color: colors.text, fontSize: 16, lineHeight: 25 },
  paragraph: { color: colors.text, fontSize: 16, lineHeight: 25, marginBottom: 15 },
  heading: { color: colors.text, fontWeight: '700', marginTop: 10, marginBottom: 12 },
  h1: { fontSize: 28, lineHeight: 34 },
  h2: { fontSize: 23, lineHeight: 30 },
  h3: { fontSize: 19, lineHeight: 26 },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  link: { color: colors.fileType, textDecorationLine: 'underline' },
  imageLabel: { color: colors.muted, fontStyle: 'italic' },
  inlineCode: { color: '#F1D796', backgroundColor: colors.surface, fontFamily: 'Menlo' },
  codeBlock: { backgroundColor: colors.surface, borderRadius: 8, padding: 12, marginBottom: 15 },
  codeText: { color: colors.text, fontSize: 13, lineHeight: 20, fontFamily: 'Menlo' },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: 12, marginBottom: 15 },
  quoteText: { color: colors.muted, fontSize: 16, lineHeight: 25 },
  list: { marginBottom: 15 },
  listItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 3 },
  listMarker: { color: colors.text, width: 25, fontSize: 16, lineHeight: 25 },
  rule: { height: 1, backgroundColor: colors.surface, marginVertical: 16 },
  tableScroll: { marginBottom: 15 },
  table: { borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.accent },
  tableRow: { flexDirection: 'row' },
  tableCell: { color: colors.text, fontSize: 14, lineHeight: 20, width: 120, padding: 8, borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.accent },
  tableHeader: { fontWeight: '700', backgroundColor: colors.surface },
});
