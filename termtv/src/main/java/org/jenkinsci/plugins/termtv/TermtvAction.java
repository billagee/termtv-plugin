package org.jenkinsci.plugins.termtv;

import hudson.FilePath;
import hudson.model.AbstractBuild;
import hudson.model.Action;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;

import javax.servlet.ServletOutputStream;

import org.kohsuke.stapler.StaplerRequest;
import org.kohsuke.stapler.StaplerResponse;

/**
 * @author billagee
 */
public class TermtvAction implements Action {
	private AbstractBuild build;
	private final String ttyrecFilename;

	public String getTtyrecFilename() {
		return ttyrecFilename;
	}

	public String getTtyrecordPath() {
		return "artifact/ttyrecordings/" + this.ttyrecFilename;
	}

	public boolean ttyrecordFileExists() throws IOException {
		String path = this.build.getArtifactsDir().getCanonicalPath() + "/ttyrecordings/" + this.ttyrecFilename;
		File f = new File(path);
		return f.exists();
	}

	public TermtvAction(AbstractBuild build, String ttyrecFilename)
			throws IOException {
		this.build = build;
		this.ttyrecFilename = ttyrecFilename;
	}

	public AbstractBuild getBuild() {
		return this.build;
	}
	
	public String getDisplayName() {
		return "TermTV";
	}

	public String getIconFileName() {
		return "terminal.png";
	}

	public String getUrlName() {
		return "termtv";
	}

	public void doDynamic(StaplerRequest request, StaplerResponse rsp)
			throws Exception {
		String path = request.getRestOfPath();
		String filename = null;
		filename = this.ttyrecFilename;
		// load file
		byte[] bytes = new byte[0];
		try {
			bytes = ttyrec(filename);
		}
		catch (IOException e) {
			return;
		}

		//rsp.setContentType("text/plain");

		rsp.setContentLength(bytes.length);
		ServletOutputStream sos = rsp.getOutputStream();
		sos.write(bytes);
		sos.flush();
		sos.close();
	}

	public byte[] readContent(InputStream is, long length) throws IOException {
		byte[] bytes = new byte[(int)length];
		
		// Read in the bytes
        int offset = 0;
        int numRead = 0;
        while (offset < bytes.length && (numRead=is.read(bytes, offset, bytes.length-offset)) >= 0) {
            offset += numRead;
        }

		return bytes;
	}

	public byte[] ttyrecArtifact(String filename) throws IOException {
		// does artifact exist?
		String path = this.build.getArtifactsDir().getCanonicalPath() + "/ttyrecordings";
		File file = new File(path + "/" + filename);
		if (file.isFile()) {
			// return artifact file
			FileInputStream fis = new FileInputStream(file);
			byte[] bytes = readContent(fis, file.length());
			fis.close();
			return bytes;
		}

		return null;
	}
	
	public byte[] liveTtyrec() throws IOException {
		try {
			// return workspace file
			FilePath fp = build.getWorkspace().child(this.ttyrecFilename);
			if (!fp.exists()) {
                return null;
			}
			InputStream is = fp.read();
			byte[] bytes = readContent(is, fp.length());
			is.read(bytes);
			return bytes;
		}
		catch (InterruptedException ex) {
            return null;
		}
	}
	
	public byte[] ttyrec(String filename) throws IOException {
		// try to find artifact
		byte[] bytes = ttyrecArtifact(filename);
		if (bytes != null)
			return bytes;
				
		return liveTtyrec();
	}
}

