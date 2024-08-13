const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");
const moduleAnalyzer = (filename) => {
  const content = fs.readFileSync(filename, "utf-8");
  const ast = parser.parse(content, {
    sourceType: "module",
  });
  const dependencies = {};
  traverse(ast, {
    ImportDeclaration({ node }) {
      const rootPath = path.dirname(filename);
      const relativePath = node.source.value;
      const absPath = "./" + path.join(rootPath, relativePath);
      dependencies[relativePath] = absPath;
    },
  });
  const sourceCode = "if (true) return;";

  const { code } = babel.transformFromAstSync(ast, sourceCode, {
    filename,
    presets: ["@babel/preset-env"],
    babelrc: false,
    configFile: false,
  });

  return { filename, dependencies, code };
};
const makeDependenciesGraph = (entry) => {
  const entryModule = moduleAnalyzer(entry); //入口文件的分析结果
  const graphArray = [entryModule]; //借助队列实现递归分析依赖模块的效果
  for (let i = 0; i < graphArray.length; i++) {
    const item = graphArray[i];
    const { dependencies } = item; //拿到依赖文件
    if (dependencies) {
      for (let j in dependencies) {
        const depModule = moduleAnalyzer(dependencies[j]);
        graphArray.push(depModule); //graphArray.length + 1
      }
    }
  }
  const graph = {};
  graphArray.forEach((item) => {
    graph[item.filename] = { dependecies: item.dependencies, code: item.code };
  });
  return graph;
};

const generateCode = (entry) => {
  const graph = JSON.stringify(makeDependenciesGraph(entry));
  return `
		(function(graph){
			function require(module) { 
				function localRequire(relativePath) {
					return require(graph[module].dependencies[relativePath]);
				}
				var exports = {};
				(function(require, exports, code){
					eval(code)
				})(localRequire, exports, graph[module].code);
				return exports;
			};
			require('${entry}')
		})(${graph});
	`;
};
const code = generateCode("./src/index.js");
console.log(code);
