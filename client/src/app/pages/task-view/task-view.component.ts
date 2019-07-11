import { Component, OnInit } from '@angular/core';
import {TaskService} from '../../task.service';
import {ActivatedRoute, Params, Router} from '@angular/router';
import {Task} from '../../models/task.model';
import {List} from '../../models/list.model';
import {HttpResponse} from '@angular/common/http';
import {AuthService} from '../../auth.service';

@Component({
  selector: 'app-task-view',
  templateUrl: './task-view.component.html',
  styleUrls: ['./task-view.component.scss']
})
export class TaskViewComponent implements OnInit {

  lists: List[];
  tasks: Task[];

  selectedListId: string;

  constructor(private taskService: TaskService, private route: ActivatedRoute, private router: Router, private authService: AuthService) { }

  ngOnInit() {
    this.route.params.subscribe((params: Params) => {
      if (params.listId) {
        this.selectedListId = params.listId;
        this.taskService.getTasks(params.listId).subscribe((tasks: Task[]) => {
          this.tasks = tasks;
        });
      } else {
        this.tasks = undefined;
      }
    });

    this.taskService.getLists().subscribe((lists: List[]) => {
      this.lists = lists;
    });
  }

  onTaskClick(task: Task) {
    // Make task completed
    this.taskService.completed(task).subscribe(() => {
      task.completed = !task.completed;
    });
  }

  onDeleteListClick() {
    this.taskService.deleteList(this.selectedListId).subscribe((res: HttpResponse<any>) => {
      this.router.navigate((['/lists']));
      console.log(res);
    });
  }

  onTaskDeleteClick(id: string) {
    this.taskService.deleteTask(this.selectedListId, id).subscribe((res: HttpResponse<any>) => {
      this.tasks = this.tasks.filter(val => val._id !== id);
      console.log(res);
    });
  }

  onClickLogOut() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
