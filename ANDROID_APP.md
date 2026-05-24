# Application Android

Objectif : transformer cette app web en application Android personnelle, installee comme une vraie app sur Samsung.

## Option recommandee

Utiliser une application Android de type Trusted Web Activity.

Cette option garde GitHub Pages comme source de l'app, mais l'ouvre dans une vraie enveloppe Android plein ecran, avec icone, nom d'application et lancement depuis l'ecran d'accueil.

## Parametres proposes

- Nom de l'app : Notes
- Package Android : `app.notes.hayden`
- URL de production : `https://infinityhaydenfrost-collab.github.io/XO/`
- Couleur theme : `#ffffff`
- Orientation : portrait
- Mode : plein ecran / standalone

## Etapes de creation

1. Installer Android Studio.
2. Installer Java si Android Studio ne le fournit pas deja.
3. Generer un projet Android Trusted Web Activity avec Bubblewrap.
4. Utiliser l'URL GitHub Pages comme source.
5. Generer un APK de test.
6. Installer l'APK sur le Samsung.

## A verifier sur mobile

- L'app s'ouvre sans barre de navigateur.
- Les notes restent presentes apres fermeture/reouverture.
- L'icone est correcte.
- Les photos dans les notes fonctionnent.
- L'edition reste fluide avec le clavier.

## Prochaine decision

Deux chemins possibles :

- APK personnel : suffisant pour ton telephone, plus simple.
- Play Store : plus long, demande un compte developpeur Google et une validation.

## Integration Android Studio

Projet detecte :

`C:\Users\infin\AndroidStudioProjects\Notes`

Le workspace actuel ne peut pas modifier directement ce dossier. Il faut donc coller les contenus ci-dessous dans Android Studio.

### 1. AndroidManifest.xml

Chemin :

`app/src/main/AndroidManifest.xml`

Remplacer le contenu par :

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="true"
        android:dataExtractionRules="@xml/data_extraction_rules"
        android:fullBackupContent="@xml/backup_rules"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.Notes"
        android:usesCleartextTraffic="false">
        <activity
            android:name=".MainActivity"
            android:configChanges="keyboardHidden|orientation|screenSize"
            android:exported="true"
            android:hardwareAccelerated="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
```

### 2. activity_main.xml

Chemin :

`app/src/main/res/layout/activity_main.xml`

Remplacer le contenu par :

```xml
<?xml version="1.0" encoding="utf-8"?>
<WebView xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/webView"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="#ffffff"
    android:overScrollMode="never" />
```

### 3. MainActivity.kt

Chemin :

`app/src/main/java/app/notes/X0/MainActivity.kt`

Remplacer le contenu par :

```kotlin
package app.notes.X0

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserRequestCode = 1001
    private val notesStorage by lazy {
        getSharedPreferences("notes_storage", Context.MODE_PRIVATE)
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        webView.settings.cacheMode = WebSettings.LOAD_DEFAULT
        webView.settings.loadWithOverviewMode = true
        webView.settings.useWideViewPort = true
        webView.settings.builtInZoomControls = false
        webView.settings.displayZoomControls = false
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.addJavascriptInterface(NotesStorageBridge(), "NotesStorage")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                return false
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback

                val intent = fileChooserParams.createIntent()
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                startActivityForResult(intent, fileChooserRequestCode)
                return true
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

        webView.loadUrl("https://infinityhaydenfrost-collab.github.io/X0/")
    }

    inner class NotesStorageBridge {
        @JavascriptInterface
        fun load(): String {
            return notesStorage.getString("state", "") ?: ""
        }

        @JavascriptInterface
        fun save(value: String) {
            notesStorage.edit().putString("state", value).apply()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == fileChooserRequestCode) {
            val result = if (resultCode == Activity.RESULT_OK) {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else {
                null
            }

            filePathCallback?.onReceiveValue(result)
            filePathCallback = null
        }
    }

    override fun onDestroy() {
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        webView.destroy()
        super.onDestroy()
    }
}
```

### 3 bis. Icône Android

Image source :

`C:\Users\infin\Downloads\Picsart_25-12-01_11-02-12-056.png`

Dans Android Studio :

1. Clic droit sur `app`.
2. Choisir `New`, puis `Image Asset`.
3. Dans `Path`, choisir l'image ci-dessus.
4. Garder le nom `ic_launcher`.
5. Garder le type `Launcher Icons (Adaptive and Legacy)`.
6. Cliquer sur `Next`, puis `Finish`.

Le nom de l'application reste `Notes`.

### 4. Lancer le test

Dans Android Studio :

1. Cliquer sur `Sync Now` si Android Studio le propose.
2. Brancher le Samsung en USB.
3. Activer le mode developpeur et le debogage USB sur le telephone.
4. Selectionner le telephone dans la barre du haut.
5. Cliquer sur le bouton vert `Run`.

Si Android Studio affiche une erreur, copier le message ici.
