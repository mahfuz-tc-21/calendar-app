package com.calendarapp.secure;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AutoUpdatePlugin.class);
        // Strip any notification routing data from the launch Intent before Capacitor
        // processes it. This prevents FCM payload data from being used for navigation.
        sanitizeIntent(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        // Strip routing data when app is resumed via a notification tap (background/foreground).
        sanitizeIntent(intent);
        super.onNewIntent(intent);
    }

    /**
     * Removes notification routing extras that could be used to navigate to private
     * destinations (chat, private space, game, journal, etc.).
     *
     * SECURITY RULE: Notification tap must ONLY open the main Calendar page.
     * The JS layer (AuthContext) handles final navigation to /calendar.
     * This method acts as a native safety net at the Android layer.
     */
    private void sanitizeIntent(Intent intent) {
        if (intent == null) return;
        Bundle extras = intent.getExtras();
        if (extras == null) return;

        // Remove any destination routing keys that could leak private content.
        String[] routingKeys = {
            "conversationId", "conversation_id",
            "senderId", "sender_id",
            "messageId", "message_id",
            "gameId", "game_id",
            "journalId", "journal_id",
            "eventId", "event_id",
            "destination", "route", "screen", "page", "url", "deeplink",
            "privateSpaceId", "private_space_id",
            "chatId", "chat_id"
        };
        for (String key : routingKeys) {
            intent.removeExtra(key);
        }
    }
}
