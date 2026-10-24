const esbuild = require('esbuild');
const watch = process.argv.includes('--watch');

async function run() {
  const ctx = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle: true,
    external: ['obsidian'],
    format: 'cjs',
    platform: 'node',
    target: 'es2018',
    outfile: 'main.js',
    sourcemap: 'inline',
    logLevel: 'info',
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});