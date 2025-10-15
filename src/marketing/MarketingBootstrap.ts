export class MarketingBootstrap {
  constructor () {
    this.add_event_listners()
  }

  public setup_model_buttons (): void {
    // add click events for each button type
    const human_button = document.getElementById('load-human-model-button')
    const fox_button = document.getElementById('load-fox-model-button')
    const bird_button = document.getElementById('load-bird-model-button')
    const dragon_button = document.getElementById('load-dragon-model-button')

    // <option value="models/model-human.glb">Human</option>
    // <option value="models/model-fox.glb">Fox</option>
    // <option value="models/model-bird.glb">Bird</option>
    // <option value="models/model-dragon.glb">Dragon</option>

    if (human_button != null) {
      human_button?.addEventListener('click', () => {
        console.log('Human model button clicked')
      })
    }

    fox_button?.addEventListener('click', () => {
      console.log('Fox model button clicked')
    })

    bird_button?.addEventListener('click', () => {
      console.log('Bird model button clicked')
    })

    dragon_button?.addEventListener('click', () => {
      console.log('Dragon model button clicked')
    })
  }

  public add_event_listners (): void {
    // event after the DOM is fully loaded for HTML elements
    document.addEventListener('DOMContentLoaded', () => {
      this.setup_model_buttons()
    })
  }
}

// instantiate the class to setup event listeners
const app = new MarketingBootstrap()
