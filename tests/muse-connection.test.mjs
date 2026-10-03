import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createMuseEegClient, decodeMuseEegPacket, MUSE_SERVICE, MUSE_CONTROL, MUSE_EEG_CHARACTERISTICS, museConnectionMessage, museConnectionDetails, formatMuseConnectionDetails } from '../lib/muse/eeg-client.mjs';

const { MuseClient } = createRequire(import.meta.url)('muse-jsx');
const Client = createMuseEegClient(MuseClient, { wait: async () => {} });

test('connection diagnostics preserve DOMException properties and serialize without an empty error object', () => {
  const error = new DOMException('Connection attempt failed.', 'NetworkError');
  assert.equal(JSON.stringify(error), '{}');
  const details = museConnectionDetails(error, 'MuseS-test', 'gatt');
  assert.deepEqual(JSON.parse(JSON.stringify(details)), {
    device: 'MuseS-test', stage: 'gatt', uuid: null, name: 'NetworkError', message: 'Connection attempt failed.',
  });
  assert.equal(formatMuseConnectionDetails(details), 'Device: MuseS-test\nStage: gatt\nNetworkError: Connection attempt failed.');
  const wrapped = Object.assign(new Error('Service unavailable', { cause: error }), { museStage: 'service', museUuid: MUSE_SERVICE });
  assert.match(formatMuseConnectionDetails(museConnectionDetails(wrapped)), new RegExp(`UUID: ${MUSE_SERVICE}`));
  assert.equal(museConnectionDetails('Driver unavailable', 'Muse', 'driver').message, 'Driver unavailable');
  assert.doesNotMatch(museConnectionDetails({}).message, /\[object Object\]/);
});

test('startup NetworkError is distinguished from a GATT connection failure', () => {
  const error = new DOMException('Write failed', 'NetworkError');
  assert.match(museConnectionMessage(museConnectionDetails(error, 'Muse', 'gatt')), /Bluetooth connection failed/);
  assert.match(museConnectionMessage(museConnectionDetails(error, 'Muse', 'start')), /EEG startup failed/);
  assert.match(museConnectionMessage(museConnectionDetails(error, 'Muse', 'driver')), /Muse driver load failed/);
});
const notFound = () => new DOMException('No matching service or characteristic', 'NotFoundError');
function packet(index = 65535) {
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer, 2, 20);
  view.setUint16(0, index);
  // Known 12-bit samples: 0 (-1000 µV) followed by 0xfff (999.5117 µV).
  for (let i = 2; i < 20; i += 3) { view.setUint8(i, 0); view.setUint8(i + 1, 15); view.setUint8(i + 2, 255); }
  return view;
}
function headset({ missing, notificationFailure } = {}) {
  const device = new EventTarget(); device.name = 'Muse-703D';
  const calls = [], writes = [];
  const characteristics = new Map([MUSE_CONTROL, ...MUSE_EEG_CHARACTERISTICS].map(uuid => {
    const characteristic = new EventTarget(); characteristic.uuid = uuid;
    characteristic.startNotifications = async () => { calls.push(['notify', uuid]); if (uuid === notificationFailure) throw new DOMException('Notification failed', 'NetworkError'); return characteristic; };
    characteristic.writeValue = async bytes => writes.push(new TextDecoder().decode(bytes.subarray(1)).trim());
    return [uuid, characteristic];
  }));
  const service = { getCharacteristic: async uuid => { calls.push(['characteristic', uuid]); if (uuid === missing || !characteristics.has(uuid)) throw notFound(); return characteristics.get(uuid); } };
  const gatt = { device, connected: false, connect: async () => { gatt.connected = true; return gatt; }, getPrimaryService: async uuid => { calls.push(['service', uuid]); if (uuid !== MUSE_SERVICE) throw notFound(); return service; }, disconnect: () => { if (gatt.connected) { gatt.connected = false; device.dispatchEvent(new Event('gattserverdisconnected')); } } };
  device.gatt = gatt;
  const emit = (electrode, index) => { const characteristic = characteristics.get(MUSE_EEG_CHARACTERISTICS[electrode]); characteristic.value = packet(index); characteristic.dispatchEvent(new Event('characteristicvaluechanged')); };
  return { device, gatt, calls, writes, emit };
}

test('Classic Muse S initializes EEG without requiring telemetry or IMU', async () => {
  const fixture = headset(), client = new Client(), stages = [], readings = [];
  await client.connect(fixture.gatt, { onStage: stage => stages.push(stage) });
  const subscription = client.eegReadings.subscribe(reading => readings.push(reading));
  await client.start();
  assert.deepEqual(stages, ['gatt', 'service']);
  assert.deepEqual(fixture.writes, ['h', 's', 'p21', 'd']);
  assert.deepEqual(fixture.calls.filter(([type]) => type === 'characteristic').map(([, uuid]) => uuid), [MUSE_CONTROL, ...MUSE_EEG_CHARACTERISTICS]);
  for (let electrode = 0; electrode < 4; electrode++) fixture.emit(electrode, 65535);
  assert.deepEqual(readings.map(reading => reading.electrode), [0, 1, 2, 3]);
  assert(readings.every(reading => reading.samples.length === 12 && Number.isFinite(reading.timestamp)));
  fixture.emit(0, 0);
  assert.equal(readings[4].timestamp - readings[0].timestamp, 46.875);
  subscription.unsubscribe(); fixture.emit(0, 1); assert.equal(readings.length, 5);
  client.disconnect(); assert.equal(fixture.gatt.connected, false);
});

test('packet decoding preserves byte offsets and actual microvolt values', () => {
  const decoded = decodeMuseEegPacket(packet(42));
  assert.equal(decoded.index, 42);
  assert.deepEqual(decoded.samples, Array.from({ length: 6 }, () => [-1000, 999.51171875]).flat());
  assert.throws(() => decodeMuseEegPacket(new DataView(new ArrayBuffer(19))), /20 bytes/);
});

test('retries settling service discovery and reports missing services accurately', async () => {
  const fixture = headset(), original = fixture.gatt.getPrimaryService;
  let attempts = 0;
  fixture.gatt.getPrimaryService = async uuid => { if (++attempts < 3) throw notFound(); return original(uuid); };
  const client = new Client(); await client.connect(fixture.gatt); assert.equal(attempts, 3); client.disconnect();
  fixture.gatt.getPrimaryService = async () => { throw notFound(); };
  await assert.rejects(new Client().connect(fixture.gatt), error => {
    assert.equal(error.museStage, 'service'); assert.equal(error.museUuid, MUSE_SERVICE);
    assert.match(museConnectionMessage(error, fixture.device.name), /Headset found.*service discovery failed/);
    assert.doesNotMatch(museConnectionMessage(error), /ไม่พบอุปกรณ์/); return true;
  });
});

test('missing EEG channels cannot silently become partial recordings', async () => {
  const fixture = headset({ missing: MUSE_EEG_CHARACTERISTICS[3] }), client = new Client();
  await assert.rejects(client.connect(fixture.gatt), error => error.museStage === 'eeg' && error.museUuid === MUSE_EEG_CHARACTERISTICS[3]);
  assert.equal(fixture.calls.filter(([type]) => type === 'notify').length, 0);
  client.disconnect();
});

test('notification failures and disconnects release subscriptions for a clean retry', async () => {
  const fixture = headset({ notificationFailure: MUSE_EEG_CHARACTERISTICS[1] }), client = new Client(), readings = [];
  client.eegReadings.subscribe(reading => readings.push(reading));
  await assert.rejects(client.connect(fixture.gatt), error => error.museStage === 'notifications');
  client.disconnect(); fixture.emit(0, 1); assert.deepEqual(readings, []);
  const healthy = headset(), connected = new Client();
  await connected.connect(healthy.gatt); connected.eegReadings.subscribe(reading => readings.push(reading));
  healthy.gatt.disconnect(); healthy.emit(0, 2); assert.deepEqual(readings, []);
  assert.equal(connected.gatt, null);
});
