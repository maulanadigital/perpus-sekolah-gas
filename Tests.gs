
function testSetup(){Logger.log(setupSheets_());}
function testPing(){Logger.log(handleRequest_({action:'ping'}));}
function testLoginAdmin(){Logger.log(handleRequest_({action:'login',username:requiredScriptProperty_('ADMIN_USERNAME'),password:requiredScriptProperty_('ADMIN_PASSWORD')}));}
// Langsung memanggil fungsi laporan (dispatcher kini mewajibkan sesi admin).
function testGeneralStats(){Logger.log(generalReport_());}

function testGetLoans(){Logger.log(getLoans_());}

function testDriveFolder() {
  const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

  const file = folder.createFile(
    'TEST_PERPUSTAKAAN_DRIVE.txt',
    'Tes penyimpanan file dari Apps Script berhasil.',
    MimeType.PLAIN_TEXT
  );

  Logger.log('BERHASIL');
  Logger.log('Nama File: ' + file.getName());
  Logger.log('File ID: ' + file.getId());
  Logger.log('Folder ID: ' + folder.getId());
}
