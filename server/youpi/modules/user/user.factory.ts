import { User } from "@/server/youpi/modules/user/user.entity";
import { UserLite } from "@/types/prisma";

export class UserFactory {
  public static createUser(dbUser: UserLite): User {
    return new User(dbUser);
  }
}
