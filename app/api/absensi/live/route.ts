import { NextRequest, NextResponse } from 'next/server'

type Client = { send: (s: string) => void }
const clients = new Set<Client>()

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const send = (d: string) => controller.enqueue(`data: ${d}\n\n`)
      const c: Client = { send }
      clients.add(c)
      send('{"kind":"hello"}')
      request.signal.addEventListener('abort', () => {
        clients.delete(c)
        controller.close()
      })
    }
  })
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    }
  })
}

export async function POST(request: NextRequest) {
  const data = await request.text()
  clients.forEach(c => c.send(data))
  return NextResponse.json({ success: true })
}
