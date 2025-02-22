import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateEmail, updatePassword, getAuth, signOut, Auth, RecaptchaVerifier, updateProfile, sendEmailVerification, browserLocalPersistence, browserSessionPersistence, RecaptchaParameters, getIdTokenResult, ParsedToken } from "firebase/auth";

import { IRegisterArgs, ILoginArgs, IUser, IAuthCallbacks, IAuthContext } from "./interfaces";

export class FirebaseAuth {

    auth: Auth;
    authActions: IAuthCallbacks;

    constructor (authActions?: IAuthCallbacks) {
        this.auth = getAuth();
        this.auth.useDeviceLanguage();

        this.getAuthProvider = this.getAuthProvider.bind(this);
        this.handleLogIn = this.handleLogIn.bind(this);
        this.handleRegister = this.handleRegister.bind(this);
        this.handleLogOut = this.handleLogOut.bind(this);
        this.handleResetPassword = this.handleResetPassword.bind(this);
        this.onUpdateUserData = this.onUpdateUserData.bind(this);
        this.getUserIdentity = this.getUserIdentity.bind(this);
        this.handleCheckAuth = this.handleCheckAuth.bind(this);
        this.createRecaptcha = this.createRecaptcha.bind(this);
        this.getPermissions = this.getPermissions.bind(this);

        this.authActions = authActions;
    }

    public async handleLogOut() {
        await signOut(this.auth);
        await this.authActions?.onLogout?.(this.auth);
    }

    public async handleRegister(args: IRegisterArgs) {
        try {
            const { email, password, displayName } = args;

            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            await sendEmailVerification(userCredential.user);
            if (userCredential.user) {
                if (displayName) {
                    await updateProfile(userCredential.user, { displayName });
                }
                this.authActions?.onRegister?.(userCredential.user);
            }

        } catch (error) {
            return Promise.reject(error);
        }
    }

    public async handleLogIn({ email, password, remember }: ILoginArgs) {
        try {
            if (this.auth) {
                await this.auth.setPersistence(remember ? browserLocalPersistence : browserSessionPersistence);

                const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
                const userToken = await userCredential?.user?.getIdToken?.();
                if (userToken) {
                    this.authActions?.onLogin?.(userCredential.user);
                } else {
                    return Promise.reject();
                }
            } else {
                return Promise.reject();
            }
        } catch (error) {
            return Promise.reject(error);
        }
    }

    public handleResetPassword(email: string) {
        return sendPasswordResetEmail(this.auth, email);
    }

    public async onUpdateUserData(args: IRegisterArgs) {

        try {
            if (this.auth?.currentUser) {
                const { displayName, email, password } = args;
                if (password) {
                    await updatePassword(this.auth.currentUser, password);
                }

                if (email && this.auth.currentUser.email !== email) {
                    await updateEmail(this.auth.currentUser, email);
                }

                if (displayName && this.auth.currentUser.displayName !== displayName) {
                    await updateProfile(this.auth.currentUser, { displayName: displayName });
                }
            }
        } catch (error) {
            return Promise.reject(error);
        }
    }

    private async getUserIdentity(): Promise<IUser> {
        const user = this.auth?.currentUser;
        return {
            ...this.auth.currentUser,
            email: user?.email || "",
            name: user?.displayName || ""
        };
    }

    private async handleCheckAuth() {
        if (this.auth?.currentUser) {
            return Promise.resolve();
        } else {
            return Promise.reject("User is not found");
        }
    }

    public async getPermissions(): Promise<ParsedToken> {
        if (this.auth?.currentUser) {
            var idTokenResult = await getIdTokenResult(this.auth.currentUser);
            return idTokenResult?.claims
        } else {
            return Promise.reject("User is not found");
        }
    }

    public createRecaptcha(containerOrId: string | HTMLDivElement, parameters?: RecaptchaParameters) {
        return new RecaptchaVerifier(containerOrId, parameters, this.auth);
    }

    public getAuthProvider(): IAuthContext {
        return {
            login: this.handleLogIn,
            logout: this.handleLogOut,
            checkAuth: this.handleCheckAuth,
            checkError: () => Promise.resolve(),
            getPermissions: this.getPermissions,
            getUserIdentity: this.getUserIdentity,
        };
    }
}