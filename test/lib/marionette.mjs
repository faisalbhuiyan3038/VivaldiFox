// Minimal Marionette (protocol v3) client. No dependencies.
// Frames are `<byteLength>:<json>`; commands are [0, id, name, params],
// responses are [1, id, error, result].
import net from "node:net";

export class Marionette {
  #sock;
  #buf = Buffer.alloc(0);
  #pending = new Map();
  #id = 0;
  #hello;

  static async connect(port = 2828, host = "127.0.0.1", retries = 120) {
    let lastErr;
    for (let i = 0; i < retries; i++) {
      try {
        const m = new Marionette();
        await m.#open(port, host);
        return m;
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 500));
      }
    }
    throw new Error(`Marionette connect failed: ${lastErr?.message}`);
  }

  #open(port, host) {
    return new Promise((resolve, reject) => {
      const s = net.createConnection({ port, host });
      this.#sock = s;
      this.#hello = { resolve, reject };
      s.on("data", d => this.#onData(d));
      s.on("error", e => {
        reject(e);
        for (const p of this.#pending.values()) p.reject(e);
      });
      s.on("close", () => {
        for (const p of this.#pending.values()) p.reject(new Error("socket closed"));
      });
    });
  }

  #onData(d) {
    this.#buf = Buffer.concat([this.#buf, d]);
    for (;;) {
      const colon = this.#buf.indexOf(0x3a);
      if (colon < 0) return;
      const len = parseInt(this.#buf.subarray(0, colon).toString(), 10);
      if (this.#buf.length < colon + 1 + len) return;
      const msg = JSON.parse(this.#buf.subarray(colon + 1, colon + 1 + len).toString());
      this.#buf = this.#buf.subarray(colon + 1 + len);
      if (!Array.isArray(msg)) {
        this.#hello?.resolve(msg);
        this.#hello = null;
        continue;
      }
      const [, id, error, result] = msg;
      const p = this.#pending.get(id);
      if (!p) continue;
      this.#pending.delete(id);
      if (error) {
        const e = new Error(`${error.error}: ${error.message}`);
        e.stack = `${e.message}\n${error.stacktrace || ""}`;
        p.reject(e);
      } else p.resolve(result);
    }
  }

  send(name, params = {}) {
    const id = ++this.#id;
    const body = JSON.stringify([0, id, name, params]);
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#sock.write(`${Buffer.byteLength(body)}:${body}`);
    });
  }

  async newSession() {
    return this.send("WebDriver:NewSession", { capabilities: { alwaysMatch: { unhandledPromptBehavior: "ignore" } } });
  }
  setContext(value) { return this.send("Marionette:SetContext", { value }); }

  /** Run `script` (function body) in the current context; returns its value. */
  async exec(script, args = [], { async = false, timeout = 30000 } = {}) {
    await this.send("WebDriver:SetTimeouts", { script: timeout });
    const r = await this.send(async ? "WebDriver:ExecuteAsyncScript" : "WebDriver:ExecuteScript", {
      script, args, newSandbox: false, sandbox: "system",
    });
    return r?.value;
  }

  async screenshot() {
    const r = await this.send("WebDriver:TakeScreenshot", { full: true });
    return Buffer.from(r.value, "base64");
  }

  close() { this.#sock?.destroy(); }
}
