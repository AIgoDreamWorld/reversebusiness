import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {publicAddress,ensurePublicDns,inspectCollectorFiles} from '../lib/source-capture.mjs';
test('private networks and query-token URLs cannot be sent to existing collector',()=>{
 const denied=['http://127.0.0.1','http://192.168.1.4','http://10.0.0.8','http://localhost','http://metadata.google.internal','https://intranet.local','https://public.example.com:8080','https://public.example.com?token=abc','ftp://public.example.com'];
 for(const url of denied)assert.throws(()=>publicAddress(url),undefined,url);
 assert.equal(publicAddress('https://example.org/product').hostname,'example.org');
});
test('DNS guard fails closed if any result is private, and allows one public IPv4 address',async()=>{
 const privateLookup=async()=>[{address:'93.184.216.34'},{address:'10.0.0.1'}];
 await assert.rejects(()=>ensurePublicDns('https://example.org',privateLookup),/DNS_NOT_PUBLIC/);
 const publicLookup=async()=>[{address:'93.184.216.34'}];
 assert.equal(await ensurePublicDns('https://example.org',publicLookup),'https://example.org/');
});
test('original collector output must match inspected URL, GET-only and SHA-256',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rebiz-source-proof-'));
 t.after(()=>fs.rmSync(dir,{force:true,recursive:true}));
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify({schema:'rebiz/report@1',meta:{target:{url:'https://example.org/product',name:'Example'},draft:true,read:{chars:2000},terms:{status:'robots-only'},scope:'One public GET'}}));
 fs.writeFileSync(path.join(dir,'requests.json'),JSON.stringify({requests:[{method:'GET',url:'https://example.org/product'}]}));
 fs.writeFileSync(path.join(dir,'source.json'),JSON.stringify({schema:'rebiz/source@1',url:'https://example.org/product'}));
 const proof=inspectCollectorFiles(dir,'https://example.org/product');
 assert.equal(proof.status,'PUBLIC_SUPPLIER_PAGE_CAPTURED_NOT_VERIFIED');
 assert.match(proof.contentHash,/^sha256:[0-9a-f]{64}$/);
 assert.equal(proof.collectionRequests,1);
 assert.throws(()=>inspectCollectorFiles(dir,'https://other.org/product'),/SOURCE_MISMATCH/);
});
