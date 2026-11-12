import React from "react";
import {Sparkles,VolumeX,Volume2} from "lucide-react";
import Button from "./Button";
import Card from "./Card";
import Badge from "./Badge";

// Independent of optional per-element deviation metadata.
export default function RecommendationReasoning({handleGetAIExplanation,loadingExplanation,aiExplanation,audioUrl,isPlaying,handlePlayAudio}) {
 return <>
                              {/* AI Explanation Button */}
                              <div className="flex justify-center">
                                <Button
                                  onClick={handleGetAIExplanation}
                                  loading={loadingExplanation}
                                  disabled={loadingExplanation}
                                  className="w-full md:w-auto"
                                  variant="success"
                                >
                                  <Sparkles className="w-4 h-4 mr-2" />
                                  {aiExplanation
                                    ? "Regenerate AI Reasoning"
                                    : "Get AI Reasoning"}
                                </Button>
                              </div>

                              {/* AI Explanation Display */}
                              {aiExplanation && (
                                <Card className="border-2 border-emerald-200">
                                  <div className="space-y-4">
                                    <div
                                      className="flex items-center gap-2 text-emerald-700 cursor-pointer hover:bg-emerald-50 p-2 rounded-lg transition-colors"
                                      onClick={
                                        audioUrl ? handlePlayAudio : undefined
                                      }
                                      title={
                                        audioUrl
                                          ? isPlaying
                                            ? "Click to pause audio"
                                            : "Click to play audio explanation"
                                          : "Audio not available"
                                      }
                                    >
                                      <Sparkles className="w-5 h-5" />
                                      <h3 className="text-lg font-semibold text-dark-900">
                                        Gemini AI Summary
                                      </h3>
                                      {audioUrl &&
                                        (isPlaying ? (
                                          <VolumeX className="w-5 h-5 text-emerald-600" />
                                        ) : (
                                          <Volume2 className="w-5 h-5 text-emerald-600" />
                                        ))}
                                      <Badge
                                        variant="success"
                                        className="ml-auto"
                                      >
                                        Gemini Powered
                                      </Badge>
                                    </div>

                                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200 rounded-lg p-6">
                                      <div className="prose prose-sm max-w-none">
                                        <div className="text-dark-800 whitespace-pre-wrap leading-relaxed">
                                          {aiExplanation}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              )}

 </>;
}
