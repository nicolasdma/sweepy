import { NextResponse } from 'next/server'

const config = {
  minExtensionVersion: '0.1.0',
  features: {
    actionsEnabled: false, // Phase 1: read-only
    unsubscribeEnabled: false,
    llmEnabled: true,
    maxEmailsPerScan: 1000,
    maxScansPerDay: 20,
  },
  maintenance: {
    enabled: false,
  },
}

export async function GET() {
  return NextResponse.json(config)
}
