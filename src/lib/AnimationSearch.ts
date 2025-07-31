import { type AnimationClip } from 'three'

interface AnimationWithState extends AnimationClip {
  isChecked?: boolean
  name: string
}

export class AnimationSearch {
  private all_animations: AnimationWithState[] = []
  private filter_input: HTMLInputElement | null = null
  private readonly animation_list_container: HTMLElement | null = null
  private current_filter_text: string = ''

  constructor (filter_input_id: string, animation_list_container_id: string) {
    this.filter_input = document.querySelector(`#${filter_input_id}`)
    this.animation_list_container = document.querySelector(`#${animation_list_container_id}`)
    this.setup_event_listeners()
  }

  public initialize_animations (animations: AnimationClip[]): void {
    console.log('AnimationSearch: initialize_animations called with', animations.length, 'animations')
    console.log('AnimationSearch: filter_input found:', this.filter_input !== null)
    console.log('AnimationSearch: animation_list_container found:', this.animation_list_container !== null)
    
    // Convert to animations with state tracking
    this.all_animations = animations.map(clip => {
      const animation_with_state: AnimationWithState = clip as any
      animation_with_state.name = clip.name
      animation_with_state.isChecked = false
      return animation_with_state
    })
    
    console.log('AnimationSearch: Converted animations:', this.all_animations.map(a => a.name))
    this.render_filtered_animations('')
  }

  private setup_event_listeners (): void {
    this.setup_filter_listener()
    this.setup_checkbox_listeners()
  }

  private setup_filter_listener (): void {
    if (this.filter_input === null) {
      return
    }

    // Remove existing event listener to avoid duplicates
    const new_filter = this.filter_input.cloneNode(true) as HTMLInputElement
    this.filter_input.parentNode?.replaceChild(new_filter, this.filter_input)
    this.filter_input = new_filter

    // Add the filter event listener
    this.filter_input.addEventListener('input', (event) => {
      const filter_text = (event.target as HTMLInputElement).value.toLowerCase()
      this.current_filter_text = filter_text
      this.render_filtered_animations(filter_text)
    })
  }

  private setup_checkbox_listeners (): void {
    if (this.animation_list_container === null) {
      return
    }

    // Add event listener to the container for checkbox changes (event delegation)
    this.animation_list_container.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement
      if (target?.type === 'checkbox') {
        this.save_current_checkbox_states()
      }
    })
  }

  private save_current_checkbox_states (): void {
    if (this.animation_list_container === null) {
      return
    }

    const checkboxes = this.animation_list_container.querySelectorAll('input[type="checkbox"]')
    checkboxes.forEach((checkbox) => {
      const input = checkbox as HTMLInputElement
      const animation_index = parseInt(input.value)
      
      if (!isNaN(animation_index) && animation_index < this.all_animations.length) {
        this.all_animations[animation_index].isChecked = input.checked
      }
    })
  }

  private render_filtered_animations (filter_text: string): void {
    if (this.animation_list_container === null) {
      return
    }

    // Filter animations based on search text
    const filtered_animations = this.all_animations.filter((animation_clip) => {
      return animation_clip.name.toLowerCase().includes(filter_text)
    })

    // Clear and rebuild the animation list
    this.animation_list_container.innerHTML = ''
    
    filtered_animations.forEach((animation_clip) => {
      if (this.animation_list_container == null) {
        return
      }

      // Find the original index in the full list for proper data-index
      const original_index = this.all_animations.findIndex(clip => clip === animation_clip)

      // Check if this animation was previously checked
      const was_checked: boolean = animation_clip.isChecked ?? false
      const checked_attribute = was_checked ? 'checked' : ''

      this.animation_list_container.innerHTML +=
              `<div class="anim-item">
                    <button class="secondary-button play" data-index="${original_index}">
                    &#9658;
                    ${animation_clip.name}
                    </button>

                  <div class="styled-checkbox">
                      <input type="checkbox" name="${animation_clip.name}" value="${original_index}" ${checked_attribute}>
                  </div>
              </div>`
    })
  }

  public get_selected_animations (): AnimationWithState[] {
    return this.all_animations.filter(animation => animation.isChecked === true)
  }

  public get_selected_animation_indices (): number[] {
    return this.all_animations
      .map((animation, index) => (animation.isChecked === true) ? index : -1)
      .filter(index => index !== -1)
  }

  public clear_filter (): void {
    if (this.filter_input !== null) {
      this.filter_input.value = ''
      this.current_filter_text = ''
      this.render_filtered_animations('')
    }
  }

  public refresh_display (): void {
    this.render_filtered_animations(this.current_filter_text)
  }
}
