import {AfterViewInit, ChangeDetectorRef, Component, HostListener, inject, OnInit, ViewChild} from '@angular/core';
import {RouterOutlet} from '@angular/router';
import {GamepadService} from './gamepad.service';
import {filter} from 'rxjs';
import {SpaceShipComponent} from './space-ship/space-ship.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SpaceShipComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, AfterViewInit {
  @ViewChild(SpaceShipComponent) spaceShipComponent?: SpaceShipComponent;

  currentState?: Gamepad;
  triggerLeft: number = 0;
  triggerRight: number = 0;
  fps: number = 0;

  private deltaT: number = 0;
  private oldTimeStamp: number = 0;

  private gamepadService = inject(GamepadService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.gamepadService.start();

    this.gamepadService
      .gamepadState$
      .pipe(
        filter(state => state != null)
      )
      .subscribe({
        next: state => {
          if (state) {
            this.currentState = state;
            this.triggerLeft = state.buttons[6].value;
            this.triggerRight = state.buttons[7].value;
          }
        }
      })
  }

  ngAfterViewInit() {
    this.gameLoop();
  }

  start() {
    this.gamepadService.start();
  }

  stop() {
    this.gamepadService.stop();
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown($event: KeyboardEvent) {
    if ($event.key === 'ArrowLeft') {
      this.triggerLeft = 1;
    } else if ($event.key === 'ArrowRight') {
      this.triggerRight = 1;
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp($event: KeyboardEvent) {
    if ($event.key === 'ArrowLeft') {
      this.triggerLeft = 0;
    } else if ($event.key === 'ArrowRight') {
      this.triggerRight = 0;
    }
  }

  private gameLoop() {
    this.draw();
    window.requestAnimationFrame(() => this.gameLoop());
  }

  private draw() {
    this.calcFps();
    this.spaceShipComponent?.tick(this.deltaT);
    this.cdr.markForCheck();
  }

  private calcFps() {
    const timeStamp = new Date().getTime();
    this.deltaT = (timeStamp - this.oldTimeStamp) / 1000;
    this.oldTimeStamp = timeStamp;
    this.fps = Math.round(1 / this.deltaT);
  }
}

