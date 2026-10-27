// End-to-end MCP test: the official MCP SDK client talks to the /mcp function over real HTTP.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import mcpFn from '../netlify/functions/mcp.mjs';

let server, url;

before(async () => {
  server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(`http://127.0.0.1${req.url}`, {
      method: req.method,
      headers: req.headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
    });
    const response = await mcpFn(request, { ip: '127.0.0.1' });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = new URL(`http://127.0.0.1:${server.address().port}/mcp`);
});

after(() => server.close());

test('an MCP client can list and call search_portfolio', async () => {
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(url));

  const { tools } = await client.listTools();
  const tool = tools.find((t) => t.name === 'search_portfolio');
  assert.ok(tool, 'search_portfolio not listed');
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.deepEqual(tool.inputSchema.required, ['query']);

  const result = await client.callTool({ name: 'search_portfolio', arguments: { query: 'Laravel projects', limit: 3 } });
  assert.ok(!result.isError);
  assert.equal(result.structuredContent.query, 'Laravel projects');
  assert.ok(result.structuredContent.results.length > 0);
  assert.ok(result.structuredContent.results.every((r) => r.url.startsWith('http')));
  assert.deepEqual(JSON.parse(result.content[0].text).results, result.structuredContent.results);

  const bad = await client.callTool({ name: 'search_portfolio', arguments: { query: '!!!' } });
  assert.equal(bad.isError, true);
  await client.close();
});

test('GET is refused with 405 (no SSE stream on serverless)', async () => {
  const res = await fetch(url, { headers: { Accept: 'text/event-stream' } });
  assert.equal(res.status, 405);
});
