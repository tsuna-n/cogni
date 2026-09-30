import test from 'node:test';
import assert from 'node:assert/strict';
import { recordedSequenceGames, sequenceAction, sequenceFromSession, sequenceGameSessionId } from '../lib/research/game-sequence.mjs';
const email='researcher@example.test';
const record=(gameId,status='complete',extra={})=>({id:`game-${gameId}`,ownerEmail:email,sequenceId:'sequence-a',sequenceBaseSessionId:'S01',gameId,status,testMode:false,...extra});
test('advances only through durably saved games in sequence order',()=>{
 const one=record(1),two=record(2),three=record(3);
 assert.equal(sequenceAction(one,[],email),null);
 assert.equal(sequenceAction(one,[{...one,status:'recording'}],email),null);
 assert.deepEqual(sequenceAction(one,[one],email),{type:'next',gameId:2});
 assert.equal(sequenceAction(two,[two],email),null);
 assert.deepEqual(sequenceAction(two,[one,two],email),{type:'next',gameId:3});
 assert.deepEqual(sequenceAction(three,[one,two,three],email),{type:'finished'});
});
test('interrupted games must be retried, with no bypass after disconnect or storage failure',()=>{
 for(const status of ['stopped','disconnect','signal_lost','hidden','task_screen_left','task_not_started','interrupted']){
  const two=record(2,status);
  assert.deepEqual(sequenceAction(two,[record(1),two],email),{type:'retry',gameId:2});
 }
 for(const status of ['recording','storage_error']){
  const two=record(2,status);
  assert.equal(sequenceAction(two,[record(1),two],email),null);
 }
});
test('other sequences, accounts, and device tests cannot unlock a game',()=>{
 const two=record(2);
 for(const first of [record(1,'complete',{sequenceId:'other'}),record(1,'complete',{ownerEmail:'other@example.test'}),record(1,'complete',{testMode:true}),record(1,'stopped')])assert.equal(sequenceAction(two,[first,two],email),null);
 assert.equal(sequenceAction(two,[record(1),two],'other@example.test'),null);
 assert.equal(sequenceAction({...two,gameId:4},[record(1),record(2),record(3)],email),null);
 assert.deepEqual([...recordedSequenceGames(undefined,[record(1)],email)],[]);
});
test('record identifiers remain distinct and fit the existing server schema',()=>{
 assert.deepEqual([1,2,3].map(id=>sequenceGameSessionId(' S01 ',id)),['S01-G1','S01-G2','S01-G3']);
 assert.equal(sequenceGameSessionId('S'.repeat(37),3).length,40);
 assert.throws(()=>sequenceGameSessionId('S'.repeat(38),1));
 assert.throws(()=>sequenceGameSessionId('S01',4));
 assert.deepEqual(sequenceFromSession(record(2)),{id:'sequence-a',baseSessionId:'S01'});
 assert.equal(sequenceFromSession(record(0,'complete',{testMode:true})),null);
 assert.equal(sequenceFromSession({gameId:2}),null);
});
