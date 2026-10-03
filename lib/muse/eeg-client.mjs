// Classic Muse EEG packets and command/timestamp behavior follow muse-jsx (MIT).
// Keep its MuseClient for commands and timing, but initialize only the sensors
// used by this workspace. Missing telemetry/IMU must not prevent EEG recording.
/*
 * Muse packet protocol attribution: muse-jsx, MIT License.
 * Copyright 2025 Satoshi Fujii and the original authors and contributors of urish/muse-js.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
export const MUSE_SERVICE = "0000fe8d-0000-1000-8000-00805f9b34fb";
export const MUSE_CONTROL = "273e0001-4c4d-454d-96be-f03bac821358";
export const MUSE_EEG_CHARACTERISTICS = [3, 4, 5, 6].map(
  (channel) => `273e000${channel}-4c4d-454d-96be-f03bac821358`,
);

function connectionError(error, stage, uuid) {
  const wrapped = new Error(error?.message || String(error), { cause: error });
  wrapped.name = error?.name || "Error";
  wrapped.museStage = stage;
  wrapped.museUuid = uuid;
  return wrapped;
}

async function discover(operation, stage, uuid, wait) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await operation(); }
    catch (error) {
      // Service discovery can still be settling just after GATT connects.
      if (error?.name !== "NotFoundError" || attempt === 2)
        throw connectionError(error, stage, uuid);
      await wait(250 * (attempt + 1));
    }
  }
}

export function decodeMuseEegPacket(value) {
  if (!(value instanceof DataView) || value.byteLength !== 20)
    throw new Error("Invalid Classic Muse EEG packet: expected 20 bytes");
  const samples = [];
  for (let offset = 2; offset < 20; offset += 3) {
    const a = (value.getUint8(offset) << 4) | (value.getUint8(offset + 1) >> 4);
    const b = ((value.getUint8(offset + 1) & 15) << 8) | value.getUint8(offset + 2);
    samples.push((a - 2048) * 0.48828125, (b - 2048) * 0.48828125);
  }
  return { index: value.getUint16(0), samples };
}

export function createMuseEegClient(MuseClient, { wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  return class MuseEegClient extends MuseClient {
    constructor() {
      super();
      this.listeners = [];
      this.observers = new Set();
      this.eegReadings = {
        subscribe: (observer) => {
          const subscriber = typeof observer === "function" ? { next: observer } : observer;
          this.observers.add(subscriber);
          return { unsubscribe: () => this.observers.delete(subscriber) };
        },
      };
      this.onDisconnected = () => {
        this.removeListeners();
        this.gatt = null;
        this.connectionStatus.next(false);
      };
    }

    async connect(gatt, { onStage = () => {} } = {}) {
      if (!gatt) throw connectionError(new Error("Device has no Bluetooth GATT server"), "gatt");
      this.gatt = gatt;
      this.deviceName = gatt.device.name || "Muse";
      try {
        if (!gatt.connected) await gatt.connect();
      } catch (error) { throw connectionError(error, "gatt"); }
      onStage("gatt");
      const service = await discover(() => gatt.getPrimaryService(MUSE_SERVICE), "service", MUSE_SERVICE, wait);
      onStage("service");
      this.controlChar = await discover(() => service.getCharacteristic(MUSE_CONTROL), "control", MUSE_CONTROL, wait);
      this.eegCharacteristics = [];
      // Discover all required channels before enabling any notifications.
      for (const uuid of MUSE_EEG_CHARACTERISTICS)
        this.eegCharacteristics.push(await discover(() => service.getCharacteristic(uuid), "eeg", uuid, wait));
      gatt.device.addEventListener("gattserverdisconnected", this.onDisconnected, { once: true });
      try { await this.controlChar.startNotifications(); }
      catch (error) { throw connectionError(error, "notifications", MUSE_CONTROL); }
      for (const [electrode, characteristic] of this.eegCharacteristics.entries()) {
        const listener = (event) => {
          let packet;
          try { packet = decodeMuseEegPacket(event.target.value); }
          catch (error) {
            for (const observer of this.observers) observer.error?.(error);
            return;
          }
          const reading = { electrode, ...packet, timestamp: this.getTimestamp(packet.index, 12, 256) };
          for (const observer of this.observers) observer.next?.(reading);
        };
        characteristic.addEventListener("characteristicvaluechanged", listener);
        this.listeners.push([characteristic, listener]);
        try { await characteristic.startNotifications(); }
        catch (error) { throw connectionError(error, "notifications", characteristic.uuid); }
      }
      this.connectionStatus.next(true);
    }

    removeListeners() {
      for (const [characteristic, listener] of this.listeners)
        characteristic.removeEventListener("characteristicvaluechanged", listener);
      this.listeners = [];
    }

    disconnect() {
      this.removeListeners();
      this.gatt?.device.removeEventListener("gattserverdisconnected", this.onDisconnected);
      super.disconnect();
      this.gatt = null;
      this.observers.clear();
    }
  };
}

// Error/DOMException properties can disappear when serialized by dev tooling.
// Read them explicitly and keep diagnostics as plain strings, not a raw error.
export function museConnectionDetails(error, deviceName = "Muse", fallbackStage = "start") {
  const message = typeof error?.message === "string" && error.message
    ? error.message
    : typeof error === "string" && error
      ? error
      : "No error message was provided by the Bluetooth driver";
  return {
    device: deviceName,
    stage: error?.museStage || error?.stage || fallbackStage,
    uuid: error?.museUuid || error?.uuid || null,
    name: error?.name || "Error",
    message,
  };
}

export function formatMuseConnectionDetails(details) {
  return [
    `Device: ${details.device}`,
    `Stage: ${details.stage}`,
    details.uuid ? `UUID: ${details.uuid}` : null,
    `${details.name}: ${details.message}`,
  ].filter(Boolean).join("\n");
}

export function museConnectionMessage(error, deviceName = "Muse") {
  const stage = error?.museStage || error?.stage;
  if (error?.name === "SecurityError" || error?.name === "NotAllowedError")
    return `Bluetooth ไม่ได้รับอนุญาต — กดเชื่อมต่อแล้วเลือก ${deviceName} อีกครั้ง / Bluetooth permission denied — select the headset again.`;
  if (stage === "driver")
    return "โหลดไดรเวอร์ Muse ไม่สำเร็จ — กดเชื่อมต่อเพื่อลองใหม่ / Muse driver load failed. Press Connect to retry.";
  if (stage === "service")
    return `พบ ${deviceName} แล้ว แต่เปิด Muse Service ไม่สำเร็จ — ปิดแอป Muse อื่นและปิด/เปิดเครื่องแล้วลองใหม่ / Headset found, but Muse service discovery failed. Close other Muse apps and power-cycle the headset.`;
  if (["control", "eeg", "notifications"].includes(stage))
    return `พบ ${deviceName} แล้ว แต่เปิดช่อง EEG ไม่สำเร็จ — ดูรายละเอียดการเชื่อมต่อด้านล่าง / Headset found, but EEG initialization failed. See connection details below.`;
  if (stage === "gatt" || (!stage && error?.name === "NetworkError"))
    return `พบ ${deviceName} แล้ว แต่เชื่อมต่อ Bluetooth ไม่สำเร็จ — ปิดแอป Muse อื่นและปิด/เปิดเครื่องแล้วลองใหม่ / Headset found, but Bluetooth connection failed. Close other Muse apps and power-cycle the headset.`;
  return "เริ่ม EEG ไม่สำเร็จ — ดูรายละเอียดการเชื่อมต่อด้านล่าง / EEG startup failed. See connection details below.";
}
