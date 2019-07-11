import { Injectable } from '@angular/core';
import {HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {empty, Observable, Subject, throwError} from 'rxjs';
import {AuthService} from './auth.service';
import {catchError, switchMap, tap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class WebReqInterceptor implements HttpInterceptor {

  refreshingAccessToken: boolean;

  accessTokenRefreshed: Subject<any> = new Subject();

  constructor(private authService: AuthService) { }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    req = this.addAuthHeader(req);

    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        console.log(error);

        if (error.status === 401) {
          return this.refreshAccessToken().pipe(
            switchMap(() => {
              req = this.addAuthHeader(req);
              return next.handle(req);
            }),
            catchError((err: any) => {
              console.log(err);
              this.authService.logout();
              return empty();
            })
          );
        }

        return throwError(error);
      })
    );
  }

  refreshAccessToken() {
    if (this.refreshingAccessToken) {
      return new Observable((observer) => {
        this.accessTokenRefreshed.subscribe(() => {
          // this code will run when the access token has been refreshed
          observer.next();
          observer.complete();
        });
      });
    } else {
      this.refreshingAccessToken = true;
      // call a method in the auth service to send a request
      return this.authService.getNewAccessToken().pipe(
        tap(() => {
          console.log('Access Token Refreshed');
          this.refreshingAccessToken = false;
          this.accessTokenRefreshed.next();
        })
      );
    }
  }

  private addAuthHeader(req: HttpRequest<any>) {
    // get the access token
    const token = this.authService.getAccessToken();

    if (token) {
      // append the access token to the request header
      return req.clone({
        setHeaders: {
          'x-access-token': token
        }
      });
    }

    return req;
  }
}
