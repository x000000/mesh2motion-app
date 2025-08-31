// Attribution/Credits Dialog Logic as a TypeScript class
export interface CreditEntry {
  name: string
  url: string
}

export class CreditsDialog {
  private readonly attribution_link: HTMLElement | null
  private readonly credits_dialog: HTMLElement | null
  private readonly close_button: HTMLElement | null
  private readonly credits_content: HTMLElement | null
  private readonly skeleton_credits: Record<string, CreditEntry[]>

  constructor () {
    this.attribution_link = document.getElementById('attribution-link')
    this.credits_dialog = document.getElementById('credits-dialog')
    this.close_button = document.getElementById('close-credits-dialog')
    this.credits_content = document.getElementById('credits-content')

    this.skeleton_credits = {
      human: [
        { name: 'Quaternius', url: 'https://quaternius.com/' },
        { name: 'Scott Petrovic', url: 'https://scottpetrovic.com' }
      ],
      fox: [
        { name: 'Scott Petrovic', url: 'https://scottpetrovic.com' }
      ],
      bird: [
        { name: 'Scott Petrovic', url: 'https://scottpetrovic.com' }
      ]
    }

    this.addEventListeners()
  }

  private get_current_skeleton_type (): string {
    const sel = document.getElementById('skeleton-selection') as HTMLSelectElement | null
    if (sel && sel.value) {
      return sel.value
    }
    return 'human'
  }

  public show (): void {
    if ((this.credits_dialog == null) || (this.credits_content == null)) return

    const skeleton_type = this.get_current_skeleton_type()
    const credits = this.skeleton_credits[skeleton_type] || []
    this.credits_dialog.style.display = 'flex'

    if (credits.length === 0) {
      this.credits_content.innerHTML = '<p>No credits available for this skeleton type.</p>'
      return
    }

    this.credits_content.innerHTML = '<ul style="padding-left: 1.2em;">' +
        credits.map(c => `<li><a href="${c.url}" target="_blank" rel="noopener">${c.name}</a></li>`)
               .join('') + '</ul>'
  }

  public hide (): void {
    if (this.credits_dialog != null) this.credits_dialog.style.display = 'none'
  }

  private addEventListeners (): void {
    this.attribution_link?.addEventListener('click', (e) => {
      e.preventDefault()
      this.show()
    })

    this.close_button?.addEventListener('click', () => {
      this.hide()
    })

    this.credits_dialog?.addEventListener('click', (e) => {
      if (e.target === this.credits_dialog) {
        this.hide()
      }
    })
  }
}
