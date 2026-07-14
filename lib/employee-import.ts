// Parsing e validação da importação de colaboradores via CSV.
// Funções puras, sem React e sem Supabase — testáveis isoladamente.

export type ImportLookupItem = {
  id: string;
  name: string;
};

export type ParsedCsvRow = {
  /** Linha no arquivo, 1-indexed contando o cabeçalho (para bater com o Excel). */
  line: number;
  nome: string;
  setor: string;
  funcao: string;
};

export type ImportErrorRow = {
  line: number;
  name: string;
  reason: string;
};

export type MissingValue = {
  name: string;
  count: number;
};

export type ValidEmployeeRow = {
  full_name: string;
  department_id: string;
  role_id: string;
};

export type ValidationResult = {
  valid: ValidEmployeeRow[];
  errors: ImportErrorRow[];
  missingDepartments: MissingValue[];
  missingRoles: MissingValue[];
};

export const REQUIRED_COLUMNS = ['nome', 'setor', 'funcao'] as const;

/**
 * Chave de comparação: sem acento, sem caixa, sem espaço nas pontas.
 * Usada tanto para casar setor/função com o cadastro quanto para detectar
 * nomes duplicados — sem isso o cadastro controlado viraria caça a acento.
 */
export function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/** Excel brasileiro costuma salvar em windows-1252; UTF-8 é a primeira tentativa. */
export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

export class CsvFormatError extends Error {}

/**
 * Lê um CSV separado por `;` com cabeçalho nome/setor/funcao.
 * O cabeçalho é casado sem acento e sem caixa, e a ordem das colunas é livre.
 * Lança CsvFormatError quando o arquivo é inutilizável (problema de arquivo,
 * não de linha).
 */
export function parseEmployeeCsv(text: string): ParsedCsvRow[] {
  // \r\n do Excel deixaria um \r grudado no último valor de cada linha.
  const rawLines = text.split(/\r?\n/);

  const headerIndex = rawLines.findIndex((line) => line.trim().length > 0);
  if (headerIndex === -1) {
    throw new CsvFormatError('O arquivo está vazio.');
  }

  const header = rawLines[headerIndex].split(';').map((column) => normalizeKey(column));

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !header.includes(column));
  if (missingColumns.length > 0) {
    throw new CsvFormatError(`Colunas obrigatórias faltando: ${missingColumns.join(', ')}.`);
  }

  const nomeIndex = header.indexOf('nome');
  const setorIndex = header.indexOf('setor');
  const funcaoIndex = header.indexOf('funcao');

  const rows: ParsedCsvRow[] = [];

  for (let i = headerIndex + 1; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    if (!rawLine.trim()) continue;

    const values = rawLine.split(';');
    rows.push({
      line: i + 1,
      nome: (values[nomeIndex] ?? '').trim(),
      setor: (values[setorIndex] ?? '').trim(),
      funcao: (values[funcaoIndex] ?? '').trim(),
    });
  }

  if (rows.length === 0) {
    throw new CsvFormatError('O arquivo não tem nenhuma linha de dados.');
  }

  return rows;
}

function buildLookup(items: ImportLookupItem[]): Map<string, string> {
  return new Map(items.map((item) => [normalizeKey(item.name), item.id]));
}

function tally(counter: Map<string, MissingValue>, name: string) {
  const key = normalizeKey(name);
  const existing = counter.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  // Guarda o nome como veio do arquivo — é o que o usuário vai reconhecer e cadastrar.
  counter.set(key, { name, count: 1 });
}

/**
 * Aplica as regras em ordem; o primeiro problema encerra a linha.
 * Nada aqui grava: o resultado alimenta a prévia, e só depois o usuário confirma.
 */
export function validateEmployeeRows(
  rows: ParsedCsvRow[],
  lookups: {
    departments: ImportLookupItem[];
    roles: ImportLookupItem[];
    /** Nomes de colaboradores já cadastrados no banco. */
    existingNames: string[];
  }
): ValidationResult {
  const departmentByName = buildLookup(lookups.departments);
  const roleByName = buildLookup(lookups.roles);
  const existingNameKeys = new Set(lookups.existingNames.map(normalizeKey));

  const valid: ValidEmployeeRow[] = [];
  const errors: ImportErrorRow[] = [];
  const missingDepartments = new Map<string, MissingValue>();
  const missingRoles = new Map<string, MissingValue>();

  // Nome -> primeira linha em que apareceu, para acusar duplicata dentro do arquivo.
  const seenInFile = new Map<string, number>();

  for (const row of rows) {
    if (!row.nome) {
      errors.push({ line: row.line, name: '(vazio)', reason: 'Nome vazio' });
      continue;
    }

    const departmentId = departmentByName.get(normalizeKey(row.setor));
    if (!departmentId) {
      const label = row.setor || '(vazio)';
      errors.push({ line: row.line, name: row.nome, reason: `Setor "${label}" não existe` });
      if (row.setor) tally(missingDepartments, row.setor);
      continue;
    }

    const roleId = roleByName.get(normalizeKey(row.funcao));
    if (!roleId) {
      const label = row.funcao || '(vazio)';
      errors.push({ line: row.line, name: row.nome, reason: `Função "${label}" não existe` });
      if (row.funcao) tally(missingRoles, row.funcao);
      continue;
    }

    const nameKey = normalizeKey(row.nome);

    if (existingNameKeys.has(nameKey)) {
      errors.push({ line: row.line, name: row.nome, reason: 'Já cadastrado' });
      continue;
    }

    const firstLine = seenInFile.get(nameKey);
    if (firstLine !== undefined) {
      // Sem esta regra a segunda linha estouraria no índice único do banco e
      // derrubaria a importação inteira com erro técnico do Postgres.
      errors.push({
        line: row.line,
        name: row.nome,
        reason: `Nome duplicado no arquivo (linha ${firstLine})`,
      });
      continue;
    }

    seenInFile.set(nameKey, row.line);
    valid.push({ full_name: row.nome, department_id: departmentId, role_id: roleId });
  }

  const byCountDesc = (a: MissingValue, b: MissingValue) => b.count - a.count || a.name.localeCompare(b.name);

  return {
    valid,
    errors,
    missingDepartments: [...missingDepartments.values()].sort(byCountDesc),
    missingRoles: [...missingRoles.values()].sort(byCountDesc),
  };
}
