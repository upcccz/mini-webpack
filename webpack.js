const fs = require('fs')
const path = require('path')

const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')
const objectKeys = require('object-keys')

// 获取模块信息的方法
function getModuleInfo(file) {
  // 1.读取文件
  const body = fs.readFileSync(file, 'utf-8');

  // 2.转换AST语法树，便于之后分析依赖、代码转换
  const ast = parser.parse(body, {
    sourceType: 'module'
  })

  // 3.分析和收集当前模块的依赖
  // 这个函数最终的返回应该是这样的
  // {
  //   'file': './src/index.js',
  //    deps: {
  //      './add.js': './src/add.js'
  //    },
  //    code: '...'
  // }
  const deps = {};
  traverse(ast, {
    ImportDeclaration({ node }) {
      // 当前执行目录
      const dirname = path.dirname(file); // dirname => ./src

      // node.source.value 就是当前模块依赖的模块的文件名称，即 import xx from 'abc' 中的 abc
      // 获取依赖模块的绝对路径
      const abspath = './' + path.join(dirname, node.source.value) // abspath => ./src/add.js

      deps[node.source.value] = abspath; // deps =>   { './add.js': './src/add.js' }
    }
  })

  // 4.es6转es5
  const { code } = babel.transformFromAst(ast, null, {
    presets: ["@babel/preset-env"]
  })

  // console.log('code: ' + code + '\n'); // 这个code就是转换出来的当前模块的代码

  // 5.组装成moduleInfo
  return {
    file,
    deps,
    code
  }
}

// 从入口开始层层递归处理模块信息
function parseModules(file) {
  // 获取入口模块的模块信息
  const entry = getModuleInfo(file);
  // 用来存储整个模块链的各个模块信息
  const temp = [entry];

  // 通过入口文件递归生成依赖关系图
  getDeps(temp, entry)

  // 组装成最终的依赖关系图
  const depsGraph = {};
  temp.forEach(info => {
    depsGraph[info.file] = {
      deps: info.deps,
      code: info.code
    }
  })

  return depsGraph;
  // depsGraph 最终的结构是这样的，即符合我们上面封装成的自执行函数中的传参 list 的样子了

  // {
  //   './src/index.js': {
  //     'deps': {'./add.js' : './src/index.js'},
  //     'code': '...'
  //   },
  //   './src/add.js': {
  //     'deps': {},
  //     'code': '...'
  //   }
  // }
}

function getDeps(temp, { deps }) {
  // 拿到模块的 deps，当deps为空时，则不会执行forEach了
  Object.keys(deps).forEach(key => {
    // 依赖的模块信息
    const child = getModuleInfo(deps[key])
    // 收集
    temp.push(child)
    // 递归获取依赖的依赖
    getDeps(temp, child)
  })
}

// console.log(parseModules('./src/index.js'));

// 通过 parseModules 我们得到了我们最终想要的自执行函数的 list 参数，那么现在需要的就是将list组装进我们的 require函数中就可以了
// 需要注意的是，depsGraph 的 key 值都是绝对路径，那么就需要做点修改
// 当递归执行依赖的时候，需要 require 一个模块的时候，代码常写的是相对路径
// 所以 提供一个 absRequire 来覆盖 eval 中依赖代码执行时的 require
// 作了一层封装，即代码层面写的仍然是相对路径，通过 deps 找到绝对路径，然后传给真正的require
function bundle(file) {
  const depsGraph = JSON.stringify(parseModules('./src/index.js'))
  return `(function (list) {
    function require (file) {
      function absRequire(relPath) {
        return require(list[file].deps[relPath])
      }

      var exports = {};
      (function (require, exports, code) {
        eval(code)
      })(absRequire, exports, list[file].code)
    
      return exports;
    }
    require('${file}')
  })(${depsGraph})`
}

const content = bundle('./src/index.js');

// 生成 dist
// 不存在就创建
!fs.existsSync('./dist') && fs.mkdirSync('./dist')
fs.writeFileSync('./dist/bundle.js', content)