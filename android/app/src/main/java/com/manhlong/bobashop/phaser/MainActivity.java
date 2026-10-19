package com.manhlong.bobashop.phaser;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // The one plugin this app has of its own: handing a downloaded .apk to the package
        // installer, for the kind of new version an over-the-air update cannot carry.
        registerPlugin(InstallPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
