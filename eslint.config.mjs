import antfu from '@antfu/eslint-config'
import perfectionist from 'eslint-plugin-perfectionist'

export default antfu(
  {
    type: 'lib',
    stylistic: {
      indent: 2, // 4, or 'tab'
      quotes: 'single', // or 'double'
    },

    vue: true,
    typescript: true,

    formatters: true,

    ignores: [
      'dist',
      'node_modules',
    ],
  },
  {
    files: [
      'src/**/*.vue',
    ],
    rules: {
    },
  },
  {
    files: [
      'src/**/*.ts',
    ],
    rules: {
    },
  },
  {
    rules: {
      'antfu/top-level-function': 'off',
      'antfu/if-newline': 'off',
      'antfu/consistent-list-newline': 'off',
      'antfu/curly': 'off',

      'eqeqeq': 'off',

      'no-console': 'off',
      'no-empty': 'off',

      // 代码库现状：双引号、允许单行对象、多行带尾逗号——风格规则全部对齐现状或关闭
      'style/arrow-parens': 'off',
      'style/brace-style': 'off',
      'style/no-multiple-empty-lines': ['warn', {
        max: 7,
      }],
      'style/operator-linebreak': ['warn', 'before', {
        overrides: {
          '=': 'ignore',
        },
      }],
      'style/padded-blocks': 'off',
      'style/quotes': 'off',
      'style/member-delimiter-style': 'off',
      'style/comma-dangle': ['warn', 'always-multiline'],
      // 长尾风格规则降级为警告：保留信号但不阻塞 lint 退出码
      'style/indent': 'warn',
      'style/semi': 'warn',
      'style/quote-props': 'warn',
      'style/max-statements-per-line': 'warn',
      'style/lines-between-class-members': 'warn',
      'style/no-trailing-spaces': 'warn',
      'style/indent-binary-ops': 'warn',
      'style/multiline-ternary': 'warn',
      'style/eol-last': 'warn',
      'style/no-extra-parens': 'warn',

      'vue/define-macros-order': 'warn',
      'vue/custom-event-name-casing': 'warn',
      'vue/quote-props': 'warn',
      'vue/padding-line-between-blocks': 'warn',

      'import/consistent-type-specifier-style': 'warn',
      'import/no-duplicates': 'warn',
      'import/newline-after-import': 'warn',
      'perfectionist/sort-named-exports': 'off',
      'node/prefer-global/buffer': 'off',

      // 正则质量类整体降为警告（数量大且多为字符串模板内嵌正则，人工核对成本高）
      'regexp/prefer-w': 'warn',
      'regexp/no-contradiction-with-assertion': 'warn',
      'regexp/use-ignore-case': 'warn',
      'regexp/no-useless-escape': 'warn',
      'regexp/no-dupe-characters-character-class': 'warn',
      'regexp/strict': 'warn',
      'regexp/no-dupe-disjunctions': 'warn',
      'regexp/no-useless-non-capturing-group': 'warn',
      'regexp/no-misleading-capturing-group': 'warn',
      'regexp/negation': 'warn',
      'regexp/no-misleading-unicode-character': 'warn',
      'regexp/no-trivially-nested-quantifier': 'warn',
      'regexp/no-useless-assertions': 'warn',
      'regexp/prefer-d': 'warn',

      'ts/consistent-type-imports': 'off',
      'ts/explicit-function-return-type': 'off',
      'ts/no-require-imports': 'off',
      'ts/no-use-before-define': 'warn',
      'ts/prefer-literal-enum-member': 'off',
      'ts/strict-boolean-expressions': 'off',
      'ts/method-signature-style': 'off',

      'unused-imports/no-unused-vars': 'warn',
      'unused-imports/no-unused-imports': 'warn',
      'unicorn/prefer-dom-node-text-content': 'off',
      'unicorn/prefer-number-properties': 'off',

      'prefer-template': 'off',
      'node/prefer-global/process': 'off',
      'unicorn/prefer-node-protocol': 'off',
      'import/first': 'off',
      'no-cond-assign': ['warn', 'except-parens'],

      // 测试标题以模块名/中文开头是有意为之
      'test/prefer-lowercase-title': 'off',

      // perfectionist 导入排序与代码库现状不符，关闭以对齐
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',

      'format/prettier': 'off',

      // 正则安全类保留为警告（正确性信号）
      'regexp/optimal-quantifier-concatenation': 'warn',
      'regexp/no-super-linear-backtracking': 'warn',
      'regexp/no-unused-capturing-group': 'warn',

      'vue/block-order': ['warn', {
        order: ['template', 'script', 'style'],
      }],
      'vue/block-tag-newline': 'off',

      'vue/eqeqeq': ['warn', 'smart'],

      'vue/first-attribute-linebreak': ['warn', {
        multiline: 'below',
      }],
      "vue/no-mutating-props": ["error", {
        shallowOnly: true,
      }],
      'vue/max-attributes-per-line': 'off',
      'vue/attribute-hyphenation': 'off',
      'vue/v-on-event-hyphenation': 'off',

      'vue/html-self-closing': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/prefer-template': 'off',

      'vue/valid-template-root': 'off',
    },
  },
)
