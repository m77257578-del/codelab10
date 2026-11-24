import prettier from 'prettier';
import parserHtml from 'prettier/plugins/html';
import parserBabel from 'prettier/plugins/babel';
import parserPostcss from 'prettier/plugins/postcss';
import parserTypescript from 'prettier/plugins/typescript';
import parserMarkdown from 'prettier/plugins/markdown';
import parserYaml from 'prettier/plugins/yaml';
import parserEstree from 'prettier/plugins/estree';

export async function formatWithPrettier(code, filename) {
  if (!code || typeof code !== 'string') return code;
  const ext = filename?.split('.').pop()?.toLowerCase();
  
  let parser = 'babel';
  let plugins = [parserBabel, parserEstree];

  if (['html', 'htm', 'svg', 'xml'].includes(ext)) {
    parser = 'html';
    plugins = [parserHtml];
  } else if (['css', 'scss', 'less'].includes(ext)) {
    parser = 'postcss';
    plugins = [parserPostcss];
  } else if (['ts', 'tsx'].includes(ext)) {
    parser = 'typescript';
    plugins = [parserTypescript, parserBabel, parserEstree];
  } else if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) {
    parser = 'babel';
    plugins = [parserBabel, parserEstree];
  } else if (['md', 'markdown'].includes(ext)) {
    parser = 'markdown';
    plugins = [parserMarkdown];
  } else if (['json'].includes(ext)) {
    parser = 'json';
    plugins = [parserBabel, parserEstree];
  } else if (['yml', 'yaml'].includes(ext)) {
    parser = 'yaml';
    plugins = [parserYaml];
  }

  try {
    const formatted = await prettier.format(code, {
      parser,
      plugins,
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: true,
    });
    return formatted;
  } catch (err) {
    console.warn('Prettier formatting warning:', err);
    throw err;
  }
}
