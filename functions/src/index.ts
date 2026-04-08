import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

export const sendRoomInvite = onDocumentCreated(
    "invites/{inviteId}",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (event: any) => {
        const invite = event.data?.data();
        if (!invite) return;

        // 1. Look up the invited user's FCM token
        const docPath = `users/${invite.toUid}`;
        const userDoc = await admin.firestore().doc(docPath).get();

        if (!userDoc.exists) {
            console.log("User not found!");
            return;
        }

        const fcmToken = userDoc.data()?.fcmToken;

        // 2. Build the exact notification payload
        const message = {
            token: fcmToken,
            notification: {
                title: "New Tastebuddy Invite! 🍔",
                body: `${invite.fromUsername} invited you to join a room!`,
            },
            data: {
                roomCode: invite.roomCode,
            },
        };

        // 3. Send it!
        await admin.messaging().send(message);
        console.log(`Successfully sent invite to ${invite.toUid}`);
    },
);