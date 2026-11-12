// Dependency regression checks only: no sandbox, network or agent is started.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const test = require('node:test');
const { createRequire } = require('node:module');
const runtimeRequire = createRequire(require.resolve('@anthropic-ai/sandbox-runtime'));
const shellquote = runtimeRequire('shell-quote');

test('the sandbox runtime resolves the patched shell-quote lock', () => {
  assert.equal(runtimeRequire('shell-quote/package.json').version, '1.12.0');
});

test('quoted sandbox arguments survive a real POSIX shell unchanged', () => {
  const args = ['', 'plain', 'space in path', "single'quote", 'double"quote',
    'line\nbreak', '$(printf INJECTED)', '`printf INJECTED`', '; printf INJECTED',
    'a*b?[c]', 'VAR=value with spaces', 'back\\slash', 'bang! and quote\''];
  // The child only serializes argv. All inputs and its source are synthetic.
  const command = shellquote.quote([process.execPath, '-e',
    'process.stdout.write(JSON.stringify(process.argv.slice(1)))', '--', ...args]);
  const actual = execFileSync('/bin/sh', ['-c', command], {
    encoding: 'utf8', timeout: 3000, maxBuffer: 65536,
  });
  assert.deepEqual(JSON.parse(actual), args);
});

test('glob quoting escapes command substitution rather than activating it', () => {
  assert.equal(shellquote.quote([{ op: 'glob', pattern: '$(printf INJECTED)*' }]),
    '\\$\\(printf\\ INJECTED\\)*');
});

test('unsupported operators and multiline comments fail closed', () => {
  assert.throws(() => shellquote.quote([{ op: 'not-an-operator' }]), TypeError);
  assert.throws(() => shellquote.quote([{ op: ';\nprintf INJECTED' }]), TypeError);
  assert.throws(() => shellquote.quote([{ comment: 'safe\nprintf INJECTED' }]), TypeError);
  assert.throws(() => shellquote.quote([{ op: 'glob', pattern: '*\nprintf INJECTED' }]), TypeError);
});
