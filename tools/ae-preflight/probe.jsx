/* Does "AfterFX.exe -r" reach this After Effects at all? Writes one line to the Desktop. */
(function () {
  var f = new File(Folder.desktop.fsName + '/campaigncut-probe.txt');
  f.encoding = 'UTF-8';
  f.open('w');
  f.write('probe ran ' + new Date().toString() + '\nproject: ' + (app.project.file ? app.project.file.fsName : '(untitled)') + '\n');
  f.close();
})();
