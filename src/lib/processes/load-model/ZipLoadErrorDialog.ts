
import { ModalDialog } from '../../ModalDialog.ts'


export class ZipLoadErrorDialog {
  private modal: ModalDialog | null = null;

  constructor(message: string) {
    this.modal = new ModalDialog('ZIP Load Error', `<p>${message}</p>`)
    this.modal.show()
  }
}

