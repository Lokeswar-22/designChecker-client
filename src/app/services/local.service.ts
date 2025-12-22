import { Injectable } from '@angular/core';

export const StorageKey = {
  UserAccountData: 'user_account_data'
};

export interface UserAccountData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  rememberMe: boolean;
  user?: any;
  projectName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class LocalService {
  constructor() {}

  setTokens(accessToken: string, refreshToken: string, expiresIn: number, rememberMe: boolean = false): void {
    const expiresAt = Date.now() + (expiresIn * 1000);
    const data: UserAccountData = this.getAccountData() || {
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      rememberMe: false
    };

    data.accessToken = accessToken;
    data.refreshToken = refreshToken;
    data.expiresAt = expiresAt;
    data.rememberMe = rememberMe;

    this.saveAccountData(data);
  }

  private saveAccountData(data: UserAccountData): void {
    localStorage.setItem(StorageKey.UserAccountData, JSON.stringify(data));
  }

  private getAccountData(): UserAccountData | null {
    const data = localStorage.getItem(StorageKey.UserAccountData);
    return data ? JSON.parse(data) : null;
  }

  getAccessToken(): string | null {
    return this.getAccountData()?.accessToken || null;
  }

  getRefreshToken(): string | null {
    return this.getAccountData()?.refreshToken || null;
  }

  isTokenExpired(): boolean {
    const expiresAt = this.getAccountData()?.expiresAt;
    return !expiresAt || Date.now() >= expiresAt;
  }

  updateAccessToken(accessToken: string, expiresIn: number): void {
    const data = this.getAccountData();
    if (data) {
      data.accessToken = accessToken;
      data.expiresAt = Date.now() + (expiresIn * 1000);
      this.saveAccountData(data);
    }
  }

  setUserData(user: any): void {
    const data = this.getAccountData() || {
      accessToken: '',
      refreshToken: '',
      expiresAt: 0,
      rememberMe: false
    };
    data.user = user;
    this.saveAccountData(data);
  }

  getUserData(): any {
    return this.getAccountData()?.user || null;
  }

  setProjectName(projectName: string): void {
    const data = this.getAccountData();
    if (data) {
      data.projectName = projectName;
      this.saveAccountData(data);
    }
  }

  getProjectName(): string | null {
    return this.getAccountData()?.projectName || null;
  }

  clearProjectName(): void {
    const data = this.getAccountData();
    if (data) {
      delete data.projectName;
      this.saveAccountData(data);
    }
  }

  clearAll(): void {
    localStorage.removeItem(StorageKey.UserAccountData);
  }

  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    return !!token && !this.isTokenExpired();
  }
}
