// app/api/chat/route.ts
// AI chat for website visitors – powered by Claude

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Jsi přátelský asistent pro chatový widget na webu lipno20.cz – Lipno Hideaway, rekreační dům na Lipně.

## O nemovitosti:
- Luxusní chalupa přímo u Lipna (přesná adresa sdělována až po rezervaci)
- Kapacita: 8 dospělých + děti
- Vybavení: plně vybavená kuchyně, obývák s krbem, sauna, zahrada, terasa s výhledem na jezero
- Dovoleno: domácí mazlíčci po dohodě
- Parkování: 2 místa před domem

## Ceník (orientační):
- Hlavní sezóna (červenec–srpen, Vánoce, Nový rok, Velikonoce): 6 500 Kč/noc
- Vedlejší sezóna: 4 500 Kč/noc
- Minimální pobyt: 3 noci v sezóně, 2 noci mimo sezónu
- Záloha: 30% při rezervaci, doplatek 30 dní před příjezdem

## Check-in/out:
- Check-in: 15:00–20:00
- Check-out: do 10:00

## Co je v okolí:
- Lipno Aquaworld (400 m), ski areál Lipno (1,5 km), cyklostezky, projíždění lodí
- Supermarket: 2 km, Restaurace: 800 m

## Jak rezervovat:
- Přes formulář na webu nebo emailem rezervace@lipno20.cz nebo telefonicky
- Platba kartou online nebo bankovním převodem

## Pravidla komunikace:
- Odpovídej v češtině, přátelsky a stručně (max 3–4 věty)
- Pokud se ptají na volné termíny, řekni jim, ať kouknou na kalendář na webu nebo pošlou email
- Pokud nevíš odpověď, přesměruj na rezervace@lipno20.cz
- Neposkytuj přesnou adresu – pouze "Lipno nad Vltavou"
- Nepotvrzuj rezervace přes chat – vždy přesměruj na formulář nebo email
`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: Message[] } = await req.json()

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'No messages' }, { status: 400 })
    }

    // Limit context to last 10 messages to save tokens
    const recentMessages = messages.slice(-10)

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: recentMessages,
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({ message: text })

  } catch (err) {
    console.error('[chat API]', err)
    return NextResponse.json({ error: 'Chat nedostupný' }, { status: 500 })
  }
}
