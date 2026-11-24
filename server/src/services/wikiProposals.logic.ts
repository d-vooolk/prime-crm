/** Блок оптовика дописывается в конец раздела через пустую строку; пустой блок текст не меняет */
export function appendProposalText(current: string, proposal: string): string {
  const block = proposal.replace(/\r\n/g, '\n').trim();
  if (!block) return current;
  const base = current.replace(/\s+$/, '');
  return base ? `${base}\n\n${block}` : block;
}
