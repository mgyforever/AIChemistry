export interface BaseBody {
  status: string;
  message: string;
  data?: any;
}

export interface RegisterBody {
  username: string;
  password: string;
  name?: string;
  email?: string;
  phone?: string;
  gender?: "male" | "female";
  grade?: string;
  birthday?: string;
}

export interface LoginBody {
  username: string;
  password: string;
}

export interface RegisterResponse extends BaseBody {
  data: {
    user: {
      id: string;
      username: string;
      name: string;
      email: string;
      phone: string;
      gender: string;
      grade: string;
      birthday: string;
      createdAt: string;
      updatedAt: string;
    };
  };
}

export interface LoginResponse extends BaseBody {
  data: {
    token: string;
    user: {
      id: string;
      username: string;
      name: string;
      email: string;
      phone: string;
      gender: string;
      grade: string;
      birthday: string;
      createdAt: string;
      updatedAt: string;
    };
  };
}
