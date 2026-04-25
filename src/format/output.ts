import chalk from 'chalk';

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatPageInfo(
  info: {
    title: string;
    id: string;
    type: string;
    status: string;
    space?: { key: string; name: string };
  },
): string {
  const lines: string[] = [
    chalk.blue('Page Information:'),
    `Title: ${chalk.green(info.title)}`,
    `ID: ${chalk.green(info.id)}`,
    `Type: ${chalk.green(info.type)}`,
    `Status: ${chalk.green(info.status)}`,
  ];
  if (info.space) {
    lines.push(`Space: ${chalk.green(info.space.name)} (${info.space.key})`);
  }
  return lines.join('\n');
}

export function formatSearchResults(
  results: Array<{ title: string; id: string; excerpt?: string }>,
): string {
  if (results.length === 0) return chalk.yellow('No results found.');
  const lines: string[] = [chalk.blue(`Found ${results.length} results:`)];
  results.forEach((r, i) => {
    lines.push(`${i + 1}. ${chalk.green(r.title)} (ID: ${r.id})`);
    if (r.excerpt) lines.push(`   ${chalk.gray(r.excerpt)}`);
  });
  return lines.join('\n');
}

export function formatSpaces(
  spaces: Array<{ key: string; name: string }>,
): string {
  const lines: string[] = [chalk.blue('Available spaces:')];
  spaces.forEach((s) => lines.push(`${chalk.green(s.key)} - ${s.name}`));
  return lines.join('\n');
}

export function formatProfiles(
  profiles: Array<{
    name: string;
    active: boolean;
    domain: string;
    readOnly: boolean;
  }>,
): string {
  const lines: string[] = [chalk.blue('Configuration profiles:\n')];
  profiles.forEach((p) => {
    const marker = p.active ? chalk.green(' (active)') : '';
    const readOnlyBadge = p.readOnly ? chalk.red(' [read-only]') : '';
    const prefix = p.active ? chalk.green('*') : ' ';
    lines.push(
      `  ${prefix} ${chalk.cyan(p.name)}${marker}${readOnlyBadge} - ${chalk.gray(p.domain)}`,
    );
  });
  return lines.join('\n');
}
