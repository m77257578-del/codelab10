// VS Code-style IntelliSense completions, snippets, and context-aware mobile keyboard shortcut configs

import { snippetCompletion } from '@codemirror/autocomplete';

const HTML_TAGS = [
  ['h1', 'Heading 1', '<h1>${1}</h1>'],
  ['h2', 'Heading 2', '<h2>${1}</h2>'],
  ['h3', 'Heading 3', '<h3>${1}</h3>'],
  ['h4', 'Heading 4', '<h4>${1}</h4>'],
  ['p', 'Paragraph', '<p>${1}</p>'],
  ['div', 'Container div', '<div>\n\t${1}\n</div>'],
  ['div.class', 'Div with class', '<div class="${1:container}">\n\t${2}\n</div>'],
  ['span', 'Inline span', '<span>${1}</span>'],
  ['a', 'Anchor link', '<a href="${1:#}">${2:رابط}</a>'],
  ['img', 'Image element', '<img src="${1:image.png}" alt="${2:وصف الصورة}" />'],
  ['video', 'Video player', '<video src="${1:video.mp4}" controls width="${2:100%}"></video>'],
  ['audio', 'Audio player', '<audio src="${1:audio.mp3}" controls></audio>'],
  ['button', 'Button', '<button type="${1:button}">${2:اضغط هنا}</button>'],
  ['input', 'Input field', '<input type="${1:text}" placeholder="${2:اكتب هنا}" />'],
  ['form', 'Form', '<form action="${1:#}" method="${2:post}">\n\t${3}\n</form>'],
  ['label', 'Form label', '<label for="${1:id}">${2:التسمية}</label>'],
  ['textarea', 'Textarea', '<textarea rows="${1:4}" placeholder="${2}"></textarea>'],
  ['select', 'Dropdown select', '<select name="${1:choice}">\n\t<option value="${2:1}">${3:خيار 1}</option>\n</select>'],
  ['option', 'Select option', '<option value="${1}">${2}</option>'],
  ['ul', 'Unordered list', '<ul>\n\t<li>${1}</li>\n</ul>'],
  ['ol', 'Ordered list', '<ol>\n\t<li>${1}</li>\n</ol>'],
  ['li', 'List item', '<li>${1}</li>'],
  ['table', 'Table', '<table>\n\t<thead>\n\t\t<tr>\n\t\t\t<th>${1:العمود}</th>\n\t\t</tr>\n\t</thead>\n\t<tbody>\n\t\t<tr>\n\t\t\t<td>${2:البيانات}</td>\n\t\t</tr>\n\t</tbody>\n</table>'],
  ['tr', 'Table row', '<tr>\n\t<td>${1}</td>\n</tr>'],
  ['th', 'Table header', '<th>${1}</th>'],
  ['td', 'Table cell', '<td>${1}</td>'],
  ['header', 'Page header', '<header>\n\t${1}\n</header>'],
  ['nav', 'Navigation bar', '<nav>\n\t${1}\n</nav>'],
  ['main', 'Main content', '<main>\n\t${1}\n</main>'],
  ['section', 'Section', '<section>\n\t${1}\n</section>'],
  ['article', 'Article', '<article>\n\t${1}\n</article>'],
  ['aside', 'Sidebar aside', '<aside>\n\t${1}\n</aside>'],
  ['footer', 'Page footer', '<footer>\n\t${1}\n</footer>'],
  ['link', 'Stylesheet link', '<link rel="stylesheet" href="${1:styles.css}" />'],
  ['script', 'Script tag', '<script src="${1:app.js}"></script>'],
  ['style', 'Inline style', '<style>\n\t${1}\n</style>'],
  ['meta', 'Meta tag', '<meta name="${1:viewport}" content="${2:width=device-width, initial-scale=1.0}" />'],
  ['br', 'Line break', '<br />'],
  ['hr', 'Horizontal rule', '<hr />'],
  ['strong', 'Bold text', '<strong>${1}</strong>'],
  ['em', 'Italic text', '<em>${1}</em>'],
  ['code', 'Inline code', '<code>${1}</code>'],
  ['pre', 'Preformatted text', '<pre>${1}</pre>'],
  ['canvas', 'HTML5 Canvas', '<canvas id="${1:canvas}" width="${2:400}" height="${3:300}"></canvas>'],
  ['iframe', 'Inline frame', '<iframe src="${1}" title="${2}"></iframe>'],
  ['!', 'HTML5 Boilerplate', '<!DOCTYPE html>\n<html lang="ar" dir="rtl">\n<head>\n\t<meta charset="UTF-8" />\n\t<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n\t<title>${1:مستند جديد}</title>\n</head>\n<body>\n\t${2}\n</body>\n</html>'],
];

const HTML_ATTRS = [
  ['class', 'CSS class', 'class="${1}"'],
  ['id', 'Element ID', 'id="${1}"'],
  ['src', 'Source URL/file', 'src="${1}"'],
  ['href', 'Link URL/file', 'href="${1}"'],
  ['alt', 'Alternative text', 'alt="${1}"'],
  ['style', 'Inline CSS', 'style="${1}"'],
  ['type', 'Input/button type', 'type="${1:text}"'],
  ['placeholder', 'Input hint', 'placeholder="${1}"'],
  ['value', 'Element value', 'value="${1}"'],
  ['name', 'Field name', 'name="${1}"'],
  ['width', 'Width', 'width="${1}"'],
  ['height', 'Height', 'height="${1}"'],
  ['controls', 'Media controls', 'controls'],
  ['autoplay', 'Autoplay media', 'autoplay'],
  ['loop', 'Loop media', 'loop'],
  ['muted', 'Mute media', 'muted'],
  ['poster', 'Video poster image', 'poster="${1}"'],
  ['target', 'Link target', 'target="_blank"'],
  ['rel', 'Link relation', 'rel="noopener noreferrer"'],
  ['disabled', 'Disable control', 'disabled'],
  ['required', 'Required field', 'required'],
  ['onclick', 'Click handler', 'onclick="${1}"'],
  ['dir', 'Text direction', 'dir="${1:rtl}"'],
  ['lang', 'Language code', 'lang="${1:ar}"'],
];

const CSS_SNIPPETS = [
  ['display: flex', 'Flexbox layout', 'display: flex;'],
  ['display: grid', 'CSS Grid layout', 'display: grid;'],
  ['display: block', 'Block display', 'display: block;'],
  ['display: inline-block', 'Inline-block', 'display: inline-block;'],
  ['display: none', 'Hide element', 'display: none;'],
  ['justify-content', 'Main-axis align', 'justify-content: ${1:center};'],
  ['align-items', 'Cross-axis align', 'align-items: ${1:center};'],
  ['flex-direction', 'Flex direction', 'flex-direction: ${1:column};'],
  ['flex-wrap', 'Wrap items', 'flex-wrap: wrap;'],
  ['gap', 'Grid/Flex gap', 'gap: ${1:16px};'],
  ['grid-template-columns', 'Grid columns', 'grid-template-columns: repeat(${1:3}, 1fr);'],
  ['place-items', 'Center grid items', 'place-items: center;'],
  ['width', 'Element width', 'width: ${1:100%};'],
  ['height', 'Element height', 'height: ${1:auto};'],
  ['min-height', 'Minimum height', 'min-height: ${1:100vh};'],
  ['max-width', 'Maximum width', 'max-width: ${1:1200px};'],
  ['padding', 'Inner spacing', 'padding: ${1:16px};'],
  ['margin', 'Outer spacing', 'margin: ${1:0 auto};'],
  ['background', 'Background color/gradient', 'background: ${1:#0f172a};'],
  ['background-color', 'Background color', 'background-color: ${1:#1e293b};'],
  ['background-image', 'Background image', 'background-image: url("${1}");'],
  ['color', 'Text color', 'color: ${1:#f8fafc};'],
  ['font-size', 'Font size', 'font-size: ${1:16px};'],
  ['font-weight', 'Font weight', 'font-weight: ${1:600};'],
  ['font-family', 'Font family', 'font-family: ${1:system-ui, sans-serif};'],
  ['line-height', 'Line height', 'line-height: ${1:1.6};'],
  ['text-align', 'Text alignment', 'text-align: ${1:center};'],
  ['text-decoration', 'Text decoration', 'text-decoration: ${1:none};'],
  ['border', 'Border shorthand', 'border: ${1:1px solid #334155};'],
  ['border-radius', 'Rounded corners', 'border-radius: ${1:12px};'],
  ['box-shadow', 'Drop shadow', 'box-shadow: ${1:0 10px 25px rgba(0,0,0,0.2)};'],
  ['position', 'Positioning', 'position: ${1:relative};'],
  ['top', 'Top offset', 'top: ${1:0};'],
  ['right', 'Right offset', 'right: ${1:0};'],
  ['bottom', 'Bottom offset', 'bottom: ${1:0};'],
  ['left', 'Left offset', 'left: ${1:0};'],
  ['z-index', 'Stack order', 'z-index: ${1:10};'],
  ['overflow', 'Overflow behavior', 'overflow: ${1:hidden};'],
  ['opacity', 'Transparency', 'opacity: ${1:0.9};'],
  ['cursor', 'Mouse cursor', 'cursor: ${1:pointer};'],
  ['transition', 'Smooth transition', 'transition: ${1:all 0.2s ease};'],
  ['transform', '2D/3D transform', 'transform: ${1:translateY(-2px)};'],
  ['object-fit', 'Media fit', 'object-fit: ${1:cover};'],
  ['@media', 'Responsive media query', '@media (max-width: ${1:768px}) {\n\t${2}\n}'],
  ['@keyframes', 'CSS Animation', '@keyframes ${1:fadeIn} {\n\tfrom { opacity: 0; }\n\tto { opacity: 1; }\n}'],
  [':hover', 'Hover selector', ':hover {\n\t${1}\n}'],
];

const JS_SNIPPETS = [
  ['console.log', 'Print to console', 'console.log(${1});', 'function'],
  ['console.error', 'Log error', 'console.error(${1});', 'function'],
  ['console.table', 'Log table', 'console.table(${1});', 'function'],
  ['const', 'Constant variable', 'const ${1:name} = ${2:value};', 'keyword'],
  ['let', 'Mutable variable', 'let ${1:name} = ${2:value};', 'keyword'],
  ['function', 'Function declaration', 'function ${1:name}(${2:params}) {\n\t${3}\n}', 'function'],
  ['arrow', 'Arrow function', 'const ${1:fn} = (${2}) => {\n\t${3}\n};', 'function'],
  ['async', 'Async function', 'async function ${1:fetchData}(${2}) {\n\t${3}\n}', 'keyword'],
  ['await', 'Await promise', 'await ${1}', 'keyword'],
  ['if', 'If statement', 'if (${1:condition}) {\n\t${2}\n}', 'keyword'],
  ['ifelse', 'If / Else', 'if (${1:condition}) {\n\t${2}\n} else {\n\t${3}\n}', 'keyword'],
  ['for', 'For loop', 'for (let ${1:i} = 0; ${1:i} < ${2:arr.length}; ${1:i}++) {\n\t${3}\n}', 'keyword'],
  ['forof', 'For..of loop', 'for (const ${1:item} of ${2:items}) {\n\t${3}\n}', 'keyword'],
  ['while', 'While loop', 'while (${1:condition}) {\n\t${2}\n}', 'keyword'],
  ['switch', 'Switch block', 'switch (${1:key}) {\n\tcase ${2:val}:\n\t\t${3}\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}', 'keyword'],
  ['try', 'Try / Catch', 'try {\n\t${1}\n} catch (${2:err}) {\n\tconsole.error(${2:err});\n}', 'keyword'],
  ['class', 'ES6 Class', 'class ${1:Name} {\n\tconstructor(${2}) {\n\t\t${3}\n\t}\n}', 'class'],
  ['return', 'Return value', 'return ${1};', 'keyword'],
  ['import', 'Import module', "import { ${2} } from '${1:module}';", 'keyword'],
  ['export', 'Export default', 'export default ${1};', 'keyword'],
  ['document.querySelector', 'Select DOM element', "document.querySelector('${1:.selector}')", 'method'],
  ['document.querySelectorAll', 'Select all elements', "document.querySelectorAll('${1:.selector}')", 'method'],
  ['document.getElementById', 'Get element by ID', "document.getElementById('${1:id}')", 'method'],
  ['document.createElement', 'Create DOM element', "document.createElement('${1:div}')", 'method'],
  ['addEventListener', 'Attach event listener', "addEventListener('${1:click}', (${2:e}) => {\n\t${3}\n})", 'method'],
  ['fetch', 'Fetch HTTP API', "fetch('${1:https://api.example.com}')\n\t.then((res) => res.json())\n\t.then((data) => console.log(data))", 'function'],
  ['setTimeout', 'Delay timer', 'setTimeout(() => {\n\t${1}\n}, ${2:1000});', 'function'],
  ['setInterval', 'Repeat interval', 'setInterval(() => {\n\t${1}\n}, ${2:1000});', 'function'],
  ['JSON.stringify', 'Object to JSON', 'JSON.stringify(${1}, null, 2)', 'method'],
  ['JSON.parse', 'JSON to Object', 'JSON.parse(${1})', 'method'],
  ['localStorage.setItem', 'Save to localStorage', "localStorage.setItem('${1:key}', ${2:value});", 'method'],
  ['localStorage.getItem', 'Read from localStorage', "localStorage.getItem('${1:key}')", 'method'],
  ['map', 'Array.map', '.map((${1:item}) => ${2:item})', 'method'],
  ['filter', 'Array.filter', '.filter((${1:item}) => ${2:true})', 'method'],
  ['reduce', 'Array.reduce', '.reduce((${1:acc}, ${2:cur}) => ${3:acc + cur}, ${4:0})', 'method'],
  ['forEach', 'Array.forEach', '.forEach((${1:item}) => {\n\t${2}\n});', 'method'],
];

const TS_EXTRA = [
  ['interface', 'TS Interface', 'interface ${1:Name} {\n\t${2:id}: ${3:number};\n}', 'interface'],
  ['type', 'TS Type alias', 'type ${1:Name} = ${2:string};', 'type'],
  ['enum', 'TS Enum', 'enum ${1:Status} {\n\t${2:Active},\n\t${3:Inactive}\n}', 'enum'],
  ['useState', 'React state hook', 'const [${1:state}, set${1:State}] = useState(${2:null});', 'function'],
  ['useEffect', 'React effect hook', 'useEffect(() => {\n\t${1}\n}, [${2}]);', 'function'],
];

const PYTHON_SNIPPETS = [
  ['print', 'Print output', 'print(${1})', 'function'],
  ['def', 'Define function', 'def ${1:func_name}(${2}):\n\t${3:pass}', 'keyword'],
  ['class', 'Define class', 'class ${1:MyClass}:\n\tdef __init__(self${2}):\n\t\t${3:pass}', 'class'],
  ['if', 'If block', 'if ${1:condition}:\n\t${2:pass}', 'keyword'],
  ['elif', 'Else-if block', 'elif ${1:condition}:\n\t${2:pass}', 'keyword'],
  ['else', 'Else block', 'else:\n\t${1:pass}', 'keyword'],
  ['for', 'For-in loop', 'for ${1:item} in ${2:items}:\n\t${3}', 'keyword'],
  ['forrange', 'For range loop', 'for ${1:i} in range(${2:10}):\n\t${3}', 'keyword'],
  ['while', 'While loop', 'while ${1:condition}:\n\t${2}', 'keyword'],
  ['try', 'Try / Except', 'try:\n\t${1}\nexcept ${2:Exception} as e:\n\tprint(e)', 'keyword'],
  ['with', 'Context manager', 'with open("${1:file.txt}", "${2:r}", encoding="utf-8") as ${3:f}:\n\t${4}', 'keyword'],
  ['import', 'Import module', 'import ${1:math}', 'keyword'],
  ['from', 'From module import', 'from ${1:module} import ${2:name}', 'keyword'],
  ['return', 'Return statement', 'return ${1}', 'keyword'],
  ['lambda', 'Lambda function', 'lambda ${1:x}: ${2:x}', 'keyword'],
  ['len', 'Length of item', 'len(${1})', 'function'],
  ['range', 'Range sequence', 'range(${1:0}, ${2:10})', 'function'],
  ['enumerate', 'Index + value', 'enumerate(${1:items})', 'function'],
  ['sorted', 'Sorted list', 'sorted(${1:items})', 'function'],
  ['sum', 'Sum iterable', 'sum(${1:nums})', 'function'],
  ['list', 'List comprehension', '[${1:x} for ${1:x} in ${2:items}]', 'type'],
  ['dict', 'Dictionary', '{${1:"key"}: ${2:"value"}}', 'type'],
  ['ifmain', 'Main entry point', 'if __name__ == "__main__":\n\t${1:main()}', 'snippet'],
];

const CPP_SNIPPETS = [
  ['#include', 'Include header', '#include <${1:iostream}>', 'keyword'],
  ['main', 'Main function', 'int main() {\n\t${1}\n\treturn 0;\n}', 'function'],
  ['cout', 'Standard output', 'cout << ${1} << endl;', 'function'],
  ['cin', 'Standard input', 'cin >> ${1};', 'function'],
  ['printf', 'C printf', 'printf("${1:%s\\n}", ${2});', 'function'],
  ['for', 'For loop', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}', 'keyword'],
  ['while', 'While loop', 'while (${1:condition}) {\n\t${2}\n}', 'keyword'],
  ['if', 'If statement', 'if (${1:condition}) {\n\t${2}\n}', 'keyword'],
  ['class', 'C++ class', 'class ${1:MyClass} {\npublic:\n\t${2}\n};', 'class'],
  ['struct', 'Struct definition', 'struct ${1:Node} {\n\t${2:int val;}\n};', 'type'],
  ['vector', 'std::vector', 'vector<${1:int}> ${2:vec};', 'type'],
  ['string', 'std::string', 'string ${1:str} = "${2}";', 'type'],
  ['using namespace std', 'Use std namespace', 'using namespace std;', 'keyword'],
  ['return', 'Return statement', 'return ${1:0};', 'keyword'],
];

const JAVA_SNIPPETS = [
  ['main', 'Main method', 'public static void main(String[] args) {\n\t${1}\n}', 'function'],
  ['sout', 'System.out.println', 'System.out.println(${1});', 'function'],
  ['class', 'Public class', 'public class ${1:Main} {\n\t${2}\n}', 'class'],
  ['for', 'For loop', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}', 'keyword'],
  ['if', 'If statement', 'if (${1:condition}) {\n\t${2}\n}', 'keyword'],
  ['while', 'While loop', 'while (${1:condition}) {\n\t${2}\n}', 'keyword'],
  ['try', 'Try / Catch', 'try {\n\t${1}\n} catch (Exception e) {\n\te.printStackTrace();\n}', 'keyword'],
  ['ArrayList', 'ArrayList', 'ArrayList<${1:String}> ${2:list} = new ArrayList<>();', 'class'],
  ['Scanner', 'Input Scanner', 'Scanner ${1:sc} = new Scanner(System.in);', 'class'],
  ['String', 'String variable', 'String ${1:name} = "${2}";', 'type'],
  ['return', 'Return value', 'return ${1};', 'keyword'],
];

const EXTRA_LANG_SNIPPETS = {
  go: [
    ['func', 'Go function', 'func ${1:name}(${2}) ${3} {\n\t${4}\n}', 'function'],
    ['fmt.Println', 'Print line', 'fmt.Println(${1})', 'function'],
    ['if', 'If block', 'if ${1:err != nil} {\n\t${2}\n}', 'keyword'],
    ['for', 'For loop', 'for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n\t${3}\n}', 'keyword'],
    ['struct', 'Struct type', 'type ${1:User} struct {\n\t${2:Name string}\n}', 'type'],
    ['package main', 'Main package', 'package main\n\nimport "fmt"', 'keyword'],
  ],
  rust: [
    ['fn', 'Rust function', 'fn ${1:name}(${2}) {\n\t${3}\n}', 'function'],
    ['println!', 'Print macro', 'println!("${1:{}}", ${2});', 'function'],
    ['let', 'Immutable binding', 'let ${1:x} = ${2};', 'keyword'],
    ['let mut', 'Mutable binding', 'let mut ${1:x} = ${2};', 'keyword'],
    ['match', 'Pattern match', 'match ${1:val} {\n\t${2:_} => ${3},\n}', 'keyword'],
    ['struct', 'Rust struct', 'struct ${1:Item} {\n\t${2:id: u32},\n}', 'type'],
    ['impl', 'Impl block', 'impl ${1:Item} {\n\t${2}\n}', 'keyword'],
  ],
  sql: [
    ['SELECT', 'Select query', 'SELECT ${1:*}\nFROM ${2:table_name}\nWHERE ${3:1 = 1};', 'keyword'],
    ['INSERT', 'Insert row', 'INSERT INTO ${1:table_name} (${2:col1, col2})\nVALUES (${3:val1, val2});', 'keyword'],
    ['UPDATE', 'Update rows', 'UPDATE ${1:table_name}\nSET ${2:col = val}\nWHERE ${3:id = 1};', 'keyword'],
    ['DELETE', 'Delete rows', 'DELETE FROM ${1:table_name}\nWHERE ${2:id = 1};', 'keyword'],
    ['CREATE TABLE', 'Create table', 'CREATE TABLE ${1:users} (\n\tid INTEGER PRIMARY KEY,\n\t${2:name} TEXT NOT NULL\n);', 'keyword'],
    ['INNER JOIN', 'Join tables', 'INNER JOIN ${1:other_table} ON ${2:a.id = b.a_id}', 'keyword'],
    ['ORDER BY', 'Sort results', 'ORDER BY ${1:created_at} DESC', 'keyword'],
    ['GROUP BY', 'Group results', 'GROUP BY ${1:column}', 'keyword'],
  ],
  php: [
    ['<?php', 'PHP tag', '<?php\n${1}\n', 'keyword'],
    ['echo', 'Echo output', 'echo ${1};', 'function'],
    ['function', 'PHP function', 'function ${1:name}(${2}) {\n\t${3}\n}', 'function'],
    ['foreach', 'Foreach loop', 'foreach (${1:$items} as ${2:$item}) {\n\t${3}\n}', 'keyword'],
    ['if', 'If block', 'if (${1:condition}) {\n\t${2}\n}', 'keyword'],
    ['class', 'PHP class', 'class ${1:App} {\n\tpublic function ${2:run}() {\n\t\t${3}\n\t}\n}', 'class'],
  ],
  csharp: [
    ['cw', 'Console.WriteLine', 'Console.WriteLine(${1});', 'function'],
    ['class', 'C# class', 'class ${1:Program} {\n\t${2}\n}', 'class'],
    ['foreach', 'Foreach loop', 'foreach (var ${1:item} in ${2:items}) {\n\t${3}\n}', 'keyword'],
    ['for', 'For loop', 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}', 'keyword'],
    ['if', 'If block', 'if (${1:condition}) {\n\t${2}\n}', 'keyword'],
  ],
  kotlin: [
    ['fun', 'Kotlin function', 'fun ${1:main}() {\n\t${2}\n}', 'function'],
    ['println', 'Print line', 'println(${1})', 'function'],
    ['val', 'Read-only value', 'val ${1:name} = ${2}', 'keyword'],
    ['var', 'Mutable variable', 'var ${1:name} = ${2}', 'keyword'],
    ['when', 'When expression', 'when (${1:x}) {\n\t${2:1} -> ${3}\n\telse -> ${4}\n}', 'keyword'],
  ],
  swift: [
    ['func', 'Swift function', 'func ${1:name}(${2}) -> ${3:Void} {\n\t${4}\n}', 'function'],
    ['print', 'Print output', 'print(${1})', 'function'],
    ['let', 'Constant', 'let ${1:name} = ${2}', 'keyword'],
    ['var', 'Variable', 'var ${1:name} = ${2}', 'keyword'],
    ['struct', 'Swift struct', 'struct ${1:Item} {\n\t${2}\n}', 'type'],
  ],
  dart: [
    ['void main', 'Entry point', 'void main() {\n\t${1}\n}', 'function'],
    ['print', 'Print output', 'print(${1});', 'function'],
    ['final', 'Final variable', 'final ${1:name} = ${2};', 'keyword'],
    ['class', 'Dart class', 'class ${1:MyWidget} {\n\t${2}\n}', 'class'],
  ],
  ruby: [
    ['def', 'Define method', 'def ${1:method_name}\n\t${2}\nend', 'function'],
    ['puts', 'Print line', 'puts ${1}', 'function'],
    ['each', 'Enumerate each', '.each do |${1:item}|\n\t${2}\nend', 'method'],
    ['if', 'If block', 'if ${1:condition}\n\t${2}\nend', 'keyword'],
  ],
  bash: [
    ['echo', 'Print text', 'echo "${1}"', 'function'],
    ['if', 'If condition', 'if [ ${1:-f file} ]; then\n\t${2}\nfi', 'keyword'],
    ['for', 'For loop', 'for ${1:i} in ${2:1 2 3}; do\n\techo "$${1:i}"\ndone', 'keyword'],
  ],
};

function toCompletions(rows, defaultType = 'keyword', boost = 10) {
  return rows.map(([label, detail, tpl, type]) =>
    snippetCompletion(tpl, {
      label,
      detail,
      type: type || defaultType,
      boost,
    })
  );
}

// Extract workspace symbols (classes, IDs, JS/Python functions, uploaded media/code filenames)
function extractWorkspaceCompletions(files = {}, currentText = '') {
  const seen = new Set();
  const options = [];

  for (const path of Object.keys(files)) {
    if (!seen.has(path)) {
      seen.add(path);
      options.push({ label: path, detail: 'ملف في المشروع', type: 'text', boost: 2 });
    }
    const content = files[path];
    if (typeof content !== 'string') continue;
    const classMatches = content.match(/\.[a-zA-Z_-][\w-]*/g) || [];
    for (const m of classMatches.slice(0, 60)) {
      const cls = m.slice(1);
      if (cls.length > 1 && !seen.has(cls)) {
        seen.add(cls);
        options.push({ label: cls, detail: `CSS class (${path})`, type: 'property', boost: 1 });
      }
    }
  }

  const wordMatches = currentText.match(/\b[a-zA-Z_][\w]{2,}\b/g) || [];
  for (const w of wordMatches.slice(0, 120)) {
    if (!seen.has(w)) {
      seen.add(w);
      options.push({ label: w, detail: 'معرّف في الملف', type: 'variable', boost: 0 });
    }
  }
  return options;
}

export function createLanguageCompletionSource(lang, filesRef) {
  return (context) => {
    const line = context.state.doc.lineAt(context.pos);
    const beforeCursor = line.text.slice(0, context.pos - line.from);
    const word = context.matchBefore(/[<@#.$]?[\w-]+/);

    if (!word && !context.explicit) return null;

    const from = word ? word.from : context.pos;
    const files = filesRef?.current || {};
    const docText = context.state.doc.toString();
    const workspaceItems = extractWorkspaceCompletions(files, docText);

    if (lang === 'html' || lang === 'svg' || lang === 'xml') {
      // Inside a tag attribute position? e.g. `<img sr` or `<div cl`
      const insideOpenTag = /<[a-zA-Z][\w-]*\s+[^>]*$/.test(beforeCursor);
      const insideSrcOrHref = /(?:src|href|poster)=["'][^"']*$/.test(beforeCursor);

      if (insideSrcOrHref) {
        const fileItems = Object.keys(files).map((p) => ({
          label: p,
          detail: 'ملف من مساحة العمل',
          type: 'text',
          boost: 25,
        }));
        const attrWord = context.matchBefore(/[\w./-]+/);
        return {
          from: attrWord ? attrWord.from : context.pos,
          options: fileItems,
          validFor: /^[\w./-]*$/,
        };
      }

      if (insideOpenTag) {
        return {
          from,
          options: [...toCompletions(HTML_ATTRS, 'property', 20), ...workspaceItems],
          validFor: /^[\w-]*$/,
        };
      }

      // Typing `<h1` or `h1`: strip leading `<` if typed so `<h1` replaces with `<h1></h1>` cleanly!
      const tagWord = context.matchBefore(/<?[a-zA-Z!][\w.-]*/);
      const tagFrom = tagWord ? tagWord.from : from;
      return {
        from: tagFrom,
        options: [
          ...HTML_TAGS.map(([label, detail, tpl]) =>
            snippetCompletion(tpl, {
              label: tagWord?.text?.startsWith('<') ? `<${label}` : label,
              detail,
              type: 'type',
              boost: 22,
            })
          ),
          ...workspaceItems,
        ],
        validFor: /^<?[\w.-]*$/,
      };
    }

    if (lang === 'css' || lang === 'scss') {
      return {
        from,
        options: [...toCompletions(CSS_SNIPPETS, 'property', 20), ...workspaceItems],
        validFor: /^[@:\w-]*$/,
      };
    }

    if (lang === 'js' || lang === 'jsx' || lang === 'ts' || lang === 'tsx') {
      const list = lang === 'ts' || lang === 'tsx' || lang === 'jsx' ? [...JS_SNIPPETS, ...TS_EXTRA] : JS_SNIPPETS;
      return {
        from,
        options: [...toCompletions(list, 'function', 18), ...workspaceItems],
        validFor: /^[\w.$]*$/,
      };
    }

    if (lang === 'python') {
      return {
        from,
        options: [...toCompletions(PYTHON_SNIPPETS, 'keyword', 18), ...workspaceItems],
        validFor: /^[\w_]*$/,
      };
    }

    if (lang === 'c' || lang === 'cpp') {
      return {
        from,
        options: [...toCompletions(CPP_SNIPPETS, 'keyword', 18), ...workspaceItems],
        validFor: /^[#\w_]*$/,
      };
    }

    if (lang === 'java') {
      return {
        from,
        options: [...toCompletions(JAVA_SNIPPETS, 'keyword', 18), ...workspaceItems],
        validFor: /^[\w_]*$/,
      };
    }

    const extra = EXTRA_LANG_SNIPPETS[lang];
    if (extra) {
      return {
        from,
        options: [...toCompletions(extra, 'keyword', 16), ...workspaceItems],
        validFor: /^[<\w._!?]*$/,
      };
    }

    if (!workspaceItems.length) return null;
    return {
      from,
      options: workspaceItems,
      validFor: /^[\w-]*$/,
    };
  };
}

// Mobile Coding Keyboard Accessory Bar configuration per language
export function getMobileBarConfig(lang) {
  switch (lang) {
    case 'html':
    case 'xml':
    case 'svg':
      return {
        symbols: ['<', '>', '/', '=', '"', "'", '!', '-', ':'],
        quickItems: HTML_TAGS.map(([label, detail, tpl]) => ({ label: `<${label}>`, detail, tpl })).concat(
          HTML_ATTRS.slice(0, 10).map(([label, detail, tpl]) => ({ label, detail, tpl }))
        ),
      };
    case 'css':
    case 'scss':
      return {
        symbols: ['{', '}', ':', ';', '.', '#', '%', '(', ')', '!', '"'],
        quickItems: CSS_SNIPPETS.map(([label, detail, tpl]) => ({ label, detail, tpl })),
      };
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return {
        symbols: ['(', ')', '{', '}', '[', ']', '=>', ';', '=', ':', "'", '"', '`', '.', '?', '&', '|'],
        quickItems: (lang === 'ts' || lang === 'tsx' || lang === 'jsx' ? [...JS_SNIPPETS, ...TS_EXTRA] : JS_SNIPPETS).map(
          ([label, detail, tpl]) => ({ label, detail, tpl })
        ),
      };
    case 'python':
      return {
        symbols: [':', '(', ')', '[', ']', '{', '}', '"', "'", '=', '#', '_', '->', '+='],
        quickItems: PYTHON_SNIPPETS.map(([label, detail, tpl]) => ({ label, detail, tpl })),
      };
    case 'c':
    case 'cpp':
      return {
        symbols: ['{', '}', '(', ')', '[', ']', ';', '#', '<', '>', '<<', '>>', '->', '::', '&', '*'],
        quickItems: CPP_SNIPPETS.map(([label, detail, tpl]) => ({ label, detail, tpl })),
      };
    case 'java':
    case 'csharp':
      return {
        symbols: ['{', '}', '(', ')', '[', ']', ';', '.', '"', '=', '=>', '<', '>'],
        quickItems: (lang === 'csharp' ? EXTRA_LANG_SNIPPETS.csharp : JAVA_SNIPPETS).map(([label, detail, tpl]) => ({
          label,
          detail,
          tpl,
        })),
      };
    case 'sql':
      return {
        symbols: ['(', ')', ';', ',', "'", '*', '=', '>', '<', '.'],
        quickItems: EXTRA_LANG_SNIPPETS.sql.map(([label, detail, tpl]) => ({ label, detail, tpl })),
      };
    case 'php':
      return {
        symbols: ['$', '->', '=>', ';', '(', ')', '{', '}', '[', ']', '"', "'", '?'],
        quickItems: EXTRA_LANG_SNIPPETS.php.map(([label, detail, tpl]) => ({ label, detail, tpl })),
      };
    case 'go':
    case 'rust':
    case 'kotlin':
    case 'swift':
    case 'dart':
    case 'ruby':
    case 'bash':
      return {
        symbols: ['{', '}', '(', ')', '[', ']', ':=', '->', '=>', ';', ':', '"', "'", '$', '|'],
        quickItems: (EXTRA_LANG_SNIPPETS[lang] || JS_SNIPPETS.slice(0, 12)).map(([label, detail, tpl]) => ({
          label,
          detail,
          tpl,
        })),
      };
    case 'json':
      return {
        symbols: ['{', '}', '[', ']', '"', ':', ',', 'true', 'false', 'null'],
        quickItems: [
          { label: '"key": "val"', detail: 'زوج مفتاح وقيمة', tpl: '"${1:key}": "${2:value}"' },
          { label: '"arr": []', detail: 'مصفوفة JSON', tpl: '"${1:items}": [\n\t${2}\n]' },
          { label: '"obj": {}', detail: 'كائن JSON', tpl: '"${1:object}": {\n\t${2}\n}' },
        ],
      };
    default:
      return {
        symbols: ['(', ')', '{', '}', '[', ']', '=', ';', ':', '"', "'", '<', '>', '/'],
        quickItems: JS_SNIPPETS.slice(0, 12).map(([label, detail, tpl]) => ({ label, detail, tpl })),
      };
  }
}
