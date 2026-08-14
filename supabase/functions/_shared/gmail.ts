// Gmail SMTP sender (implicit TLS, port 465) — replaces Resend across all functions.

interface SendGmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface SendGmailResult {
  success: boolean;
  error?: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function b64(input: string): string {
  return btoa(String.fromCharCode(...encoder.encode(input)));
}

function encodeHeader(value: string): string {
  // RFC 2047 encoding so emojis/accents survive in Subject/From headers.
  // deno-lint-ignore no-control-regex
  return /^[\x20-\x7E]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`;
}

class SmtpClient {
  private conn: Deno.TlsConn;
  private buffer = '';

  constructor(conn: Deno.TlsConn) {
    this.conn = conn;
  }

  async read(): Promise<string> {
    const chunk = new Uint8Array(4096);
    const n = await this.conn.read(chunk);
    if (n === null) return '';
    this.buffer = decoder.decode(chunk.subarray(0, n));
    return this.buffer;
  }

  async command(cmd: string, expect: string[]): Promise<string> {
    if (cmd) await this.conn.write(encoder.encode(`${cmd}\r\n`));
    let response = '';
    // Read until we get a final (non-continuation) reply line.
    for (let i = 0; i < 10; i++) {
      response += await this.read();
      const lines = response.trimEnd().split('\r\n');
      const last = lines[lines.length - 1] ?? '';
      if (/^\d{3} /.test(last)) break;
    }
    const code = response.trimEnd().split('\r\n').pop()?.slice(0, 3) ?? '';
    if (!expect.includes(code)) {
      throw new Error(`SMTP "${cmd.split(' ')[0] || 'GREETING'}" failed: ${response.trim()}`);
    }
    return response;
  }

  close() {
    try {
      this.conn.close();
    } catch (_) {
      // already closed
    }
  }
}

export async function sendGmail({ to, subject, html, text }: SendGmailInput): Promise<SendGmailResult> {
  const user = Deno.env.get('GMAIL_USER');
  const password = (Deno.env.get('GMAIL_APP_PASSWORD') ?? '').replaceAll(' ', '');
  const fromName = Deno.env.get('GMAIL_FROM_NAME') ?? "Patrichia Kavingo Store";

  if (!user || !password) {
    return { success: false, error: 'GMAIL_USER or GMAIL_APP_PASSWORD not configured' };
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { success: false, error: `Invalid recipient: ${to}` };
  }

  let client: SmtpClient | null = null;
  try {
    const conn = await Deno.connectTls({ hostname: 'smtp.gmail.com', port: 465 });
    client = new SmtpClient(conn);

    await client.command('', ['220']);
    await client.command('EHLO patrichia-store', ['250']);
    await client.command('AUTH LOGIN', ['334']);
    await client.command(b64(user), ['334']);
    await client.command(b64(password), ['235']);
    await client.command(`MAIL FROM:<${user}>`, ['250']);
    await client.command(`RCPT TO:<${to}>`, ['250', '251']);
    await client.command('DATA', ['354']);

    const boundary = `bnd_${crypto.randomUUID().replaceAll('-', '')}`;
    const plain = text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    const message = [
      `From: ${encodeHeader(fromName)} <${user}>`,
      `To: <${to}>`,
      `Reply-To: ${user}`,
      `Subject: ${encodeHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${crypto.randomUUID()}@patrichia-store>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      b64(plain).replace(/(.{76})/g, '$1\r\n'),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: base64',
      '',
      b64(html).replace(/(.{76})/g, '$1\r\n'),
      `--${boundary}--`,
      '',
    ].join('\r\n');

    // Dot-stuffing so a lone "." line cannot terminate DATA early.
    const body = message.split('\r\n').map((l) => (l.startsWith('.') ? `.${l}` : l)).join('\r\n');
    await client.command(`${body}\r\n.`, ['250']);
    await client.command('QUIT', ['221']);
    client.close();
    return { success: true };
  } catch (err) {
    client?.close();
    const error = err instanceof Error ? err.message : String(err);
    console.error('sendGmail failed:', error);
    return { success: false, error };
  }
}
