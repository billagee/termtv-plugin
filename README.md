TermTV Jenkins Plugin
=====================

This plugin integrates the [TermTV][1] terminal recording viewer with the [Jenkins CI server][5].

TermTV is a JavaScript-based viewer for [ttyrec][4] and [termrec][6] files. More information is available at the TermTV wiki: [http://www.fact-project.org/termtv/][1]

Once this plugin is installed, enabling the TermTV checkbox in a project's configuration will add a "TermTV" link to each of the project's build pages (in the left column).

The link leads to the TermTV viewer, which upon loading will attempt to begin playback of the terminal recording file found in your workspace.

By default, the recording file is expected to be named "ttyrecord" (the default output filename used by ttyrec); if you want to use a different name, the file name is customizable in the project configuration.

Usage Example
-------------
Here's a scenario where TermTV might be useful in a project:

- Let's say your Jenkins project runs tests involving an ncurses-based program (such as tmux), and you wish to see what the live terminal output would've looked like when originally displayed (rather than only examining the raw Jenkins output log for the build).
- To accomplish that, in your project configuration, enable the TermTV checkbox, and leave the default artifact filename ("ttyrecord") in place.
- Make sure your project leaves a terminal recording file named "ttyrecord" in the workspace when it runs - for example, you might launch an Expect (or Python pexpect!) script that runs the [ttyrec][4] program before any other commands.
  - NOTE: Jenkins shell script build steps that simply contain the command "ttyrec" at the top will not produce a complete recording, since Jenkins' shell scripts run in non-interactive mode by default. A separate shell must be launched by the build step to handle that issue.
- Once a build completes, click the link for the build in Jenkins, then click that build's "TermTV" link. That should display the viewer and begin playback of the ttyrecord file.
- If you wish to load the recording in a command-line player (such as ttyplay or [IPBT][7]) for finer control over playback, you can simply use the artifact download link at the top of the build's TermTV page to download the recording.

Contributors
------------
1. [Bill Agee][2]
2. Portions of code from the Jenkins [Live Screenshot plugin][8]

[1]: http://www.fact-project.org/termtv/
[2]: https://github.com/billagee
[4]: http://0xcc.net/ttyrec/index.html.en
[5]: http://jenkins-ci.org/
[6]: http://angband.pl/termrec.html
[7]: http://www.chiark.greenend.org.uk/~sgtatham/ipbt/
[8]: https://github.com/jenkinsci/livescreenshot-plugin

Screenshot
----------

FIXME

TermTV's license file
---------------------

<pre>

--------------------------------  TermTV ------------------------------------ 
-----------------------------------------------------------------------------


Copyright (c) 2014, Thomas Bretz
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS
IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A
PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


--------------------------  jsttyplay / showtty ----------------------------- 
----------------- https://github.com/encryptio/jsttyplay --------------------

Copyright (c) 2007-2008 Jack Christopher Kastorff

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions, and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * The name Jack Christopher Kastorff may not be used to endorse or
      promote products derived from this software without specific prior
      written permission.


----------------------------- CryptoJS v1.3.2 -------------------------------
-------------------- https://code.google.com/p/crypto-js/ -------------------

Copyright (c) 2009-2013 Jeff Mott

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

</pre>

