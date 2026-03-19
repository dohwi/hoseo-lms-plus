const globals = require('globals');

module.exports = [
    {
        files: ['**/*.js'],
        ignores: ['node_modules/**'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.node,
                chrome: 'readonly'
            }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            'no-var': 'error',
            'prefer-const': 'error',
            'prefer-arrow-callback': 'off',
            'eqeqeq': ['error', 'always'],
            'no-unsafe-negation': 'error'
        }
    }
];
