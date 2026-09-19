"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HEART_RATE_SERVICE = 0x180d;
const HEART_RATE_MEASUREMENT = 0x2a37;
const BATTERY_SERVICE = 0x180f;
const BATTERY_LEVEL = 0x2a19;

const IOT_PRESETS = {
  custom: { label: "Custom UUID / กำหนดเอง", service: "", characteristic: "" },
  battery: { label: "Battery level / ระดับแบตเตอรี่", service: "180f", characteristic: "2a19" },
  temperature: { label: "Temperature / อุณหภูมิ", service: "181a", characteristic: "2a6e" },
  humidity: { label: "Humidity / ความชื้น", service: "181a", characteristic: "2a6f" },
  digital: { label: "Automation IO — Digital", service: "1815", characteristic: "2a56" },
  analog: { label: "Automation IO — Analog", service: "1815", characteristic: "2a58" },
};

function bluetoothError(error) {
  if (error?.name === "NotFoundError") return "ยกเลิกการเลือกหรือไม่พบอุปกรณ์ / Selection cancelled or device not found";
  if (error?.name === "SecurityError" || error?.name === "NotAllowedError") {
    return "Bluetooth ถูกบล็อก — ใช้ HTTPS/localhost และอนุญาตสิทธิ์ Bluetooth / Bluetooth permission denied";
  }
  if (error?.name === "NetworkError") return "เชื่อมต่อ GATT ไม่สำเร็จ — ปิดแอปอื่นที่ใช้อุปกรณ์แล้วลองใหม่ / GATT connection failed";
  return `${error?.name || "Error"}: ${error?.message || String(error)}`;
}

function parseHeartRate(value) {
  const flags = value.getUint8(0);
  const usesUint16 = Boolean(flags & 0x01);
  let offset = 1;
  const bpm = usesUint16 ? value.getUint16(offset, true) : value.getUint8(offset);
  offset += usesUint16 ? 2 : 1;

  const contactSupported = Boolean(flags & 0x04);
  const contactDetected = contactSupported ? Boolean(flags & 0x02) : null;
  let energy = null;
  if (flags & 0x08) {
    energy = value.getUint16(offset, true);
    offset += 2;
  }

  const rrIntervals = [];
  if (flags & 0x10) {
    while (offset + 1 < value.byteLength) {
      rrIntervals.push(Math.round((value.getUint16(offset, true) / 1024) * 1000));
      offset += 2;
    }
  }
  return { bpm, contactSupported, contactDetected, energy, rrIntervals };
}

function normalizeUuid(value, label) {
  const uuid = value.trim().toLowerCase().replace(/^0x/, "");
  if (/^[0-9a-f]{4}$/.test(uuid) || /^[0-9a-f]{8}$/.test(uuid)) return Number.parseInt(uuid, 16);
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)) return uuid;
  throw new Error(`${label} ต้องเป็น UUID 16/32-bit หรือ UUID เต็ม เช่น 180f หรือ 12345678-1234-1234-1234-123456789abc`);
}

function valueBytes(value) {
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function describeValue(value) {
  const bytes = valueBytes(value);
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
  const text = new TextDecoder().decode(bytes).replace(/\0/g, "").trim();
  const printable = text && [...text].every((char) => char === "\n" || char === "\r" || char === "\t" || char.charCodeAt(0) >= 32);
  return { hex: hex || "—", text: printable ? text : "" };
}

function characteristicCapabilities(characteristic) {
  const properties = characteristic.properties;
  return [
    properties.read && "Read",
    properties.notify && "Notify",
    properties.indicate && "Indicate",
    properties.write && "Write",
    properties.writeWithoutResponse && "Write without response",
  ].filter(Boolean);
}

export default function BleDevicesPanel() {
  const [supported, setSupported] = useState(null);
  const [heartBusy, setHeartBusy] = useState(false);
  const [heartStatus, setHeartStatus] = useState("Not connected / ยังไม่เชื่อมต่อ");
  const [heartDevice, setHeartDevice] = useState("—");
  const [heartRate, setHeartRate] = useState(null);
  const [heartBattery, setHeartBattery] = useState(null);
  const [heartContact, setHeartContact] = useState("—");
  const [rrInterval, setRrInterval] = useState(null);

  const [preset, setPreset] = useState("custom");
  const [serviceUuid, setServiceUuid] = useState("");
  const [characteristicUuid, setCharacteristicUuid] = useState("");
  const [iotBusy, setIotBusy] = useState(false);
  const [iotStatus, setIotStatus] = useState("Not connected / ยังไม่เชื่อมต่อ");
  const [iotDevice, setIotDevice] = useState("—");
  const [iotCapabilities, setIotCapabilities] = useState([]);
  const [iotValue, setIotValue] = useState({ hex: "—", text: "" });
  const [writeFormat, setWriteFormat] = useState("text");
  const [writeValue, setWriteValue] = useState("");

  const heartDeviceRef = useRef(null);
  const heartCharacteristicRef = useRef(null);
  const iotDeviceRef = useRef(null);
  const iotCharacteristicRef = useRef(null);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && Boolean(navigator.bluetooth) && window.isSecureContext);
  }, []);

  const onHeartMeasurement = useCallback((event) => {
    const measurement = parseHeartRate(event.target.value);
    setHeartRate(measurement.bpm);
    setHeartContact(measurement.contactSupported ? (measurement.contactDetected ? "Detected / สัมผัสแล้ว" : "Not detected / ไม่สัมผัส") : "Not reported");
    setRrInterval(measurement.rrIntervals.at(-1) ?? null);
    setHeartStatus("● Receiving heart rate / กำลังรับค่าชีพจร");
  }, []);

  const disconnectHeartRate = useCallback(() => {
    const characteristic = heartCharacteristicRef.current;
    if (characteristic) characteristic.removeEventListener("characteristicvaluechanged", onHeartMeasurement);
    heartCharacteristicRef.current = null;
    if (heartDeviceRef.current?.gatt?.connected) heartDeviceRef.current.gatt.disconnect();
    heartDeviceRef.current = null;
    setHeartBusy(false);
    setHeartStatus("Not connected / ยังไม่เชื่อมต่อ");
  }, [onHeartMeasurement]);

  const connectHeartRate = async () => {
    if (!supported || heartBusy) return;
    disconnectHeartRate();
    setHeartBusy(true);
    setHeartStatus("Select a heart-rate sensor… / เลือกเครื่องวัดชีพจร");
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [HEART_RATE_SERVICE] }],
        optionalServices: [BATTERY_SERVICE],
      });
      heartDeviceRef.current = device;
      device.addEventListener(
        "gattserverdisconnected",
        () => {
          heartCharacteristicRef.current = null;
          heartDeviceRef.current = null;
          setHeartBusy(false);
          setHeartStatus("Disconnected / การเชื่อมต่อถูกตัด");
        },
        { once: true },
      );
      setHeartDevice(device.name || "Heart-rate sensor");
      setHeartStatus("Connecting GATT… / กำลังเชื่อมต่อ");
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(HEART_RATE_SERVICE);
      const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
      heartCharacteristicRef.current = characteristic;
      characteristic.addEventListener("characteristicvaluechanged", onHeartMeasurement);
      await characteristic.startNotifications();

      try {
        const batteryService = await server.getPrimaryService(BATTERY_SERVICE);
        const batteryCharacteristic = await batteryService.getCharacteristic(BATTERY_LEVEL);
        const batteryValue = await batteryCharacteristic.readValue();
        setHeartBattery(batteryValue.getUint8(0));
      } catch {
        setHeartBattery(null);
      }
      setHeartStatus("Connected — waiting for BPM… / เชื่อมต่อแล้ว รอค่าชีพจร");
    } catch (error) {
      disconnectHeartRate();
      setHeartStatus(bluetoothError(error));
    } finally {
      setHeartBusy(false);
    }
  };

  const onIotValue = useCallback((event) => {
    setIotValue(describeValue(event.target.value));
    setIotStatus("● Receiving data / กำลังรับข้อมูล");
  }, []);

  const disconnectIot = useCallback(() => {
    const characteristic = iotCharacteristicRef.current;
    if (characteristic) characteristic.removeEventListener("characteristicvaluechanged", onIotValue);
    iotCharacteristicRef.current = null;
    if (iotDeviceRef.current?.gatt?.connected) iotDeviceRef.current.gatt.disconnect();
    iotDeviceRef.current = null;
    setIotBusy(false);
    setIotCapabilities([]);
    setIotStatus("Not connected / ยังไม่เชื่อมต่อ");
  }, [onIotValue]);

  const connectIot = async () => {
    if (!supported || iotBusy) return;
    let service;
    let characteristicId;
    try {
      service = normalizeUuid(serviceUuid, "Service UUID");
      characteristicId = normalizeUuid(characteristicUuid, "Characteristic UUID");
    } catch (error) {
      setIotStatus(error.message);
      return;
    }

    disconnectIot();
    setIotBusy(true);
    setIotStatus("Select a BLE IoT device… / เลือกอุปกรณ์ IoT");
    try {
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [service] });
      iotDeviceRef.current = device;
      device.addEventListener(
        "gattserverdisconnected",
        () => {
          iotCharacteristicRef.current = null;
          iotDeviceRef.current = null;
          setIotBusy(false);
          setIotCapabilities([]);
          setIotStatus("Disconnected / การเชื่อมต่อถูกตัด");
        },
        { once: true },
      );
      setIotDevice(device.name || "Unnamed BLE device");
      setIotStatus("Connecting GATT… / กำลังเชื่อมต่อ");
      const server = await device.gatt.connect();
      const primaryService = await server.getPrimaryService(service);
      const characteristic = await primaryService.getCharacteristic(characteristicId);
      iotCharacteristicRef.current = characteristic;
      const capabilities = characteristicCapabilities(characteristic);
      setIotCapabilities(capabilities);

      if (characteristic.properties.notify || characteristic.properties.indicate) {
        characteristic.addEventListener("characteristicvaluechanged", onIotValue);
        await characteristic.startNotifications();
      }
      if (characteristic.properties.read) setIotValue(describeValue(await characteristic.readValue()));
      setIotStatus(`Connected / เชื่อมต่อแล้ว${capabilities.length ? ` — ${capabilities.join(", ")}` : ""}`);
    } catch (error) {
      disconnectIot();
      setIotStatus(bluetoothError(error));
    } finally {
      setIotBusy(false);
    }
  };

  const readIot = async () => {
    const characteristic = iotCharacteristicRef.current;
    if (!characteristic?.properties.read) {
      setIotStatus("Characteristic นี้ไม่รองรับ Read / Read is not supported");
      return;
    }
    try {
      setIotValue(describeValue(await characteristic.readValue()));
      setIotStatus("Read complete / อ่านข้อมูลสำเร็จ");
    } catch (error) {
      setIotStatus(bluetoothError(error));
    }
  };

  const writeIot = async () => {
    const characteristic = iotCharacteristicRef.current;
    if (!characteristic || (!characteristic.properties.write && !characteristic.properties.writeWithoutResponse)) {
      setIotStatus("Characteristic นี้ไม่รองรับ Write / Write is not supported");
      return;
    }
    try {
      let bytes;
      if (writeFormat === "hex") {
        const clean = writeValue.replace(/\s+/g, "");
        if (!clean || clean.length % 2 || !/^[0-9a-f]+$/i.test(clean)) throw new Error("Hex ต้องเป็นคู่ เช่น 01 ff 0a");
        bytes = Uint8Array.from(clean.match(/.{2}/g), (pair) => Number.parseInt(pair, 16));
      } else {
        bytes = new TextEncoder().encode(writeValue);
      }
      if (characteristic.properties.write && typeof characteristic.writeValueWithResponse === "function") {
        await characteristic.writeValueWithResponse(bytes);
      } else if (typeof characteristic.writeValueWithoutResponse === "function") {
        await characteristic.writeValueWithoutResponse(bytes);
      } else {
        await characteristic.writeValue(bytes);
      }
      setIotStatus(`Write complete / ส่งข้อมูลสำเร็จ (${bytes.length} bytes)`);
    } catch (error) {
      setIotStatus(bluetoothError(error));
    }
  };

  useEffect(
    () => () => {
      const heartCharacteristic = heartCharacteristicRef.current;
      if (heartCharacteristic) heartCharacteristic.removeEventListener("characteristicvaluechanged", onHeartMeasurement);
      if (heartDeviceRef.current?.gatt?.connected) heartDeviceRef.current.gatt.disconnect();
      const iotCharacteristic = iotCharacteristicRef.current;
      if (iotCharacteristic) iotCharacteristic.removeEventListener("characteristicvaluechanged", onIotValue);
      if (iotDeviceRef.current?.gatt?.connected) iotDeviceRef.current.gatt.disconnect();
    },
    [onHeartMeasurement, onIotValue],
  );

  const choosePreset = (event) => {
    const nextPreset = event.target.value;
    setPreset(nextPreset);
    setServiceUuid(IOT_PRESETS[nextPreset].service);
    setCharacteristicUuid(IOT_PRESETS[nextPreset].characteristic);
  };

  const unavailable = supported === false;

  return (
    <div className="card" style={{ marginTop: "14px" }}>
      <div className="hero">
        <div>
          <h3 style={{ marginBottom: "6px" }}>BLE Health &amp; IoT Devices / อุปกรณ์สุขภาพและ IoT</h3>
          <p className="muted">Standard Heart Rate Profile · Custom BLE GATT Read / Notify / Write</p>
        </div>
        <span className="pill" style={unavailable ? { background: "#4a1d22", color: "#ff8b8b" } : undefined}>
          {supported === null ? "Checking Bluetooth…" : unavailable ? "Web Bluetooth unavailable" : "BLE ready / พร้อมใช้งาน"}
        </span>
      </div>

      {unavailable && (
        <div className="notice" style={{ borderLeftColor: "var(--red)", color: "#ff8b8b" }}>
          Web Bluetooth ไม่พร้อมใน browser นี้ — ใช้ Chrome/Edge ผ่าน HTTPS หรือ localhost และเปิด Web Bluetooth flags บน Linux
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", alignItems: "start" }}>
        <div className="card">
          <h3>❤️ Heart-rate monitor / เครื่องวัดชีพจร</h3>
          <p className="muted">รองรับสายคาดอกและเซนเซอร์ที่ใช้ Bluetooth Heart Rate Service มาตรฐาน</p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
            <div className="card metric">
              <small>Heart rate</small>
              <b id="heartRateValue" style={{ fontSize: "32px" }}>{heartRate ?? "—"}</b>
              <span className="muted">BPM</span>
            </div>
            <div className="card metric">
              <small>Battery</small>
              <b id="heartBatteryValue">{heartBattery == null ? "—" : `${heartBattery}%`}</b>
              <span className="muted">{heartDevice}</span>
            </div>
          </div>
          <p className="muted" style={{ marginTop: "10px" }}>
            Contact: {heartContact} · RR: {rrInterval == null ? "—" : `${rrInterval} ms`}
          </p>
          <div className="controls">
            <button id="connectHeartRateBtn" type="button" disabled={supported !== true || heartBusy} onClick={connectHeartRate}>
              {heartBusy ? "Connecting…" : "Connect heart-rate sensor / เชื่อมต่อชีพจร"}
            </button>
            <button type="button" className="secondary" disabled={!heartDeviceRef.current} onClick={disconnectHeartRate}>
              Disconnect
            </button>
          </div>
          <div id="heartRateStatus" className="notice" style={{ borderLeftColor: heartStatus.startsWith("●") ? "var(--green)" : "var(--cyan)" }}>
            {heartStatus}
          </div>
        </div>

        <div className="card">
          <h3>📡 Generic BLE IoT / อุปกรณ์ IoT ทั่วไป</h3>
          <p className="muted">เลือก preset หรือกรอก UUID จากคู่มืออุปกรณ์ จากนั้นเลือกอุปกรณ์ใน Bluetooth popup</p>
          <label>
            Preset
            <select id="iotPreset" value={preset} onChange={choosePreset}>
              {Object.entries(IOT_PRESETS).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
            <label>
              Service UUID
              <input id="iotServiceUuid" value={serviceUuid} onChange={(event) => setServiceUuid(event.target.value)} placeholder="เช่น 181a หรือ UUID เต็ม" />
            </label>
            <label>
              Characteristic UUID
              <input id="iotCharacteristicUuid" value={characteristicUuid} onChange={(event) => setCharacteristicUuid(event.target.value)} placeholder="เช่น 2a6e หรือ UUID เต็ม" />
            </label>
          </div>
          <div className="controls">
            <button id="connectIotBtn" type="button" disabled={supported !== true || iotBusy} onClick={connectIot}>
              {iotBusy ? "Connecting…" : "Connect IoT device / เชื่อมต่อ IoT"}
            </button>
            <button type="button" className="secondary" disabled={!iotCharacteristicRef.current?.properties.read} onClick={readIot}>
              Read
            </button>
            <button type="button" className="secondary" disabled={!iotDeviceRef.current} onClick={disconnectIot}>
              Disconnect
            </button>
          </div>
          <div id="iotStatus" className="notice">
            <b>{iotDevice}</b>
            <br />
            {iotStatus}
            {iotCapabilities.length > 0 && <><br />Capabilities: {iotCapabilities.join(", ")}</>}
          </div>
          <div className="card" style={{ marginTop: "10px" }}>
            <small className="muted">Latest value / ค่าล่าสุด</small>
            {iotValue.text && <div style={{ marginTop: "6px", overflowWrap: "anywhere" }}>Text: {iotValue.text}</div>}
            <div id="iotHexValue" style={{ marginTop: "6px", fontFamily: "var(--font-geist-mono)", overflowWrap: "anywhere" }}>HEX: {iotValue.hex}</div>
          </div>
          <div className="grid" style={{ gridTemplateColumns: "130px 1fr", alignItems: "end", marginTop: "10px" }}>
            <label>
              Write format
              <select value={writeFormat} onChange={(event) => setWriteFormat(event.target.value)}>
                <option value="text">Text / UTF-8</option>
                <option value="hex">HEX bytes</option>
              </select>
            </label>
            <label>
              Value / ค่าที่ส่ง
              <input id="iotWriteValue" value={writeValue} onChange={(event) => setWriteValue(event.target.value)} placeholder={writeFormat === "hex" ? "01 ff 0a" : "ON"} />
            </label>
          </div>
          <button id="writeIotBtn" type="button" disabled={!iotCharacteristicRef.current || (!iotCharacteristicRef.current.properties.write && !iotCharacteristicRef.current.properties.writeWithoutResponse)} onClick={writeIot}>
            Write / ส่งคำสั่ง
          </button>
        </div>
      </div>
      <p className="muted" style={{ marginTop: "12px" }}>
        ข้อมูลสุขภาพเป็นข้อมูลจากเซนเซอร์สำหรับงานทดลอง ไม่ใช่ผลวินิจฉัยทางการแพทย์ · IoT ต้องเป็น BLE GATT; อุปกรณ์ Wi-Fi/MQTT และ Bluetooth Classic ต้องใช้ gateway หรือ API เพิ่มเติม
      </p>
    </div>
  );
}
