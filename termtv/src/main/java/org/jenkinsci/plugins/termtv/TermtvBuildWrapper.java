package org.jenkinsci.plugins.termtv;

import hudson.Extension;
import hudson.Launcher;
import hudson.model.AbstractBuild;
import hudson.model.AbstractProject;
import hudson.model.BuildListener;
import hudson.tasks.BuildWrapper;
import hudson.tasks.BuildWrapperDescriptor;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;

import java.io.IOException;
import java.io.OutputStream;

import org.kohsuke.stapler.DataBoundConstructor;

public class TermtvBuildWrapper extends BuildWrapper {
	private final String ttyrecordFilename;

	public String getTtyrecordFilename() {
		return ttyrecordFilename;
	}

	@DataBoundConstructor
	public TermtvBuildWrapper(String ttyrecordFilename) {
		this.ttyrecordFilename = ttyrecordFilename;
	}

	@Override
	public Environment setUp(AbstractBuild build, Launcher launcher,
			BuildListener listener) throws IOException, InterruptedException {

		// add action to job
		final TermtvAction action = new TermtvAction(build,
			this.ttyrecordFilename);
		build.addAction(action);

		// copy ttyrecord to artifact dir when build finishes:
		return new Environment() {
			@Override
			public boolean tearDown(AbstractBuild build, BuildListener listener)
					throws IOException, InterruptedException {
				
				// create artifacts directory
				String path = build.getArtifactsDir().getCanonicalPath() + "/ttyrecordings";
				File ttyrecordingsDir = new File(path);
				ttyrecordingsDir.mkdirs();
				
				// store artifacts
				try {
					byte[] bytes = action.liveTtyrec();
					if (bytes != null) {
						OutputStream os = new FileOutputStream(path + "/" + ttyrecordFilename);
						os.write(bytes);
						os.close();
					}
				}
				catch (IOException e) {
				}
				
				return true;
			}
		};
	}

	@Extension
	public static final class DescriptorImpl extends BuildWrapperDescriptor {
		@Override
		public String getDisplayName() {
			return "Add TermTV terminal recording viewer link to build page";
		}

		@Override
		public boolean isApplicable(AbstractProject<?, ?> item) {
			return true;
		}
	}
}

