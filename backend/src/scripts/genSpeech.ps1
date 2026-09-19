Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$dest = Join-Path $PSScriptRoot "canned_speech.wav"
$s.SetOutputToWaveFile($dest, $fmt)
$s.Speak("Hello Kidsko, what is two plus two?")
$s.Dispose()
Write-Host "Generated canned speech at: $dest"
