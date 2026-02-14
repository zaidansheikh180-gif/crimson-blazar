$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/"
$modelsDiff = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

$dest = "public/models"
If (!(Test-Path $dest)) { New-Item -ItemType Directory -Force -Path $dest }

ForEach ($model in $modelsDiff) {
    $url = "$baseUrl$model"
    $out = "$dest/$model"
    Write-Host "Downloading $model..."
    Invoke-WebRequest -Uri $url -OutFile $out
}
Write-Host "Done downloading models."
