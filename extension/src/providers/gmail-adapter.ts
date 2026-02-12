import type {
  EmailProvider,
  ActionResult,
  UnsubscribeInfo,
} from '@shared/types/email-provider'
import type { EmailMetadata, ScanOptions } from '@shared/types/email'

/**
 * Gmail provider using gmail.js (DOM-based).
 * Implements EmailProvider interface for future migration to Gmail API.
 */
export class GmailAdapter implements EmailProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private gmail: any

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(gmailInstance: any) {
    this.gmail = gmailInstance
  }

  async getEmails(_options: ScanOptions): Promise<EmailMetadata[]> {
    // TODO: Implement using gmail.js
    // gmail.new.get.email_data() for individual emails
    // Process in micro-batches of 10
    void this.gmail
    throw new Error('Not implemented yet')
  }

  async archiveEmail(_id: string): Promise<ActionResult> {
    return { status: 'error', error: 'Actions not available in Phase 1' }
  }

  async moveToLabel(_id: string, _label: string): Promise<ActionResult> {
    return { status: 'error', error: 'Actions not available in Phase 1' }
  }

  async markAsRead(_id: string): Promise<ActionResult> {
    return { status: 'error', error: 'Actions not available in Phase 1' }
  }

  async getUnsubscribeInfo(_id: string): Promise<UnsubscribeInfo | null> {
    // TODO: Extract from email headers via MIME parser
    return null
  }
}
