package com.mahagnan.model;

public class ExamSettings {

    private int interviewDuration;
    private int mcqDuration;
    private int maxWarnings;
    private boolean resultsPublished;
    private boolean examEnabled;

    public ExamSettings() {
    }

    public int getInterviewDuration() {
        return interviewDuration;
    }

    public void setInterviewDuration(int interviewDuration) {
        this.interviewDuration = interviewDuration;
    }

    public int getMcqDuration() {
        return mcqDuration;
    }

    public void setMcqDuration(int mcqDuration) {
        this.mcqDuration = mcqDuration;
    }

    public int getMaxWarnings() {
        return maxWarnings;
    }

    public void setMaxWarnings(int maxWarnings) {
        this.maxWarnings = maxWarnings;
    }

    public boolean isResultsPublished() {
        return resultsPublished;
    }

    public void setResultsPublished(boolean resultsPublished) {
        this.resultsPublished = resultsPublished;
    }

    public boolean isExamEnabled() {
        return examEnabled;
    }

    public void setExamEnabled(boolean examEnabled) {
        this.examEnabled = examEnabled;
    }
}
